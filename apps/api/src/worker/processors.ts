import type { SupabaseClient } from '@supabase/supabase-js';
import { dbscanCluster, type DbPoint } from '@blockd2d/shared';
import { stringify } from 'csv-stringify/sync';
import PDFDocument from 'pdfkit';
import { env } from "../lib/env"
import twilio from 'twilio';

const twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

const PALETTE = [
  '#E74C3C','#E67E22','#F1C40F','#2ECC71','#1ABC9C','#3498DB','#9B59B6','#34495E',
  '#16A085','#27AE60','#2980B9','#8E44AD','#2C3E50','#C0392B','#D35400'
];

function pickColor(i: number) {
  return PALETTE[i % PALETTE.length];
}

async function updateClusterSet(client: SupabaseClient, org_id: string, cluster_set_id: string, patch: any) {
  await client.from('cluster_sets').update(patch).eq('org_id', org_id).eq('id', cluster_set_id);
}

export async function processJob(client: SupabaseClient, job: any) {
  switch (job.type) {
    case 'cluster_generate':
      return await processClusterGenerate(client, job);
    case 'export_sales':
      return await processExportSales(client, job);
    case 'export_assignments':
      return await processExportAssignments(client, job);
    case 'contract_generate':
      return await processContractGenerate(client, job);
    case 'twilio_send_sms':
      return await processTwilioSendSms(client, job);
    default:
      return { ok: true, skipped: true, reason: 'unknown type' };
  }
}

async function processClusterGenerate(client: SupabaseClient, job: any) {
  const { org_id } = job;
  const cluster_set_id = job.payload?.cluster_set_id as string;
  if (!org_id || !cluster_set_id) throw new Error('missing org_id/cluster_set_id');

  const { data: set } = await client.from('cluster_sets').select('*').eq('org_id', org_id).eq('id', cluster_set_id).single();
  if (!set) throw new Error('cluster_set not found');

  await updateClusterSet(client, org_id, cluster_set_id, { status: 'running', progress: 1 });

  const filters = set.filters_json || {};
  const radius_m = Number(filters.radius_m || 500);
  const min_houses = Number(filters.min_houses || 12);
  const value_min = filters.value_min != null ? Number(filters.value_min) : null;
  const value_max = filters.value_max != null ? Number(filters.value_max) : null;
  const exclude_dnk = !!filters.exclude_dnk;
  const only_unworked = !!filters.only_unworked;

  // Load properties
  let q = client
    .from('properties')
    .select('id,lat,lng,value_estimate')
    .eq('org_id', org_id)
    .eq('county_id', set.county_id)
    .limit(200000);

  if (value_min != null) q = q.gte('value_estimate', value_min);
  if (value_max != null) q = q.lte('value_estimate', value_max);

  const { data, error } = await q;
  let props = (data as any[]) || null;
  if (error) throw new Error(error.message);

  if ((exclude_dnk || only_unworked) && (props || []).length) {
    // Optional property filters based on interaction history
    const propIds = (props || []).map((p: any) => p.id);
    const worked = new Set<string>();
    const dnk = new Set<string>();
    // Chunked IN queries to avoid URL limits
    for (let i = 0; i < propIds.length; i += 5000) {
      const chunk = propIds.slice(i, i + 5000);
      const { data: inter, error: ie } = await client
        .from('interactions')
        .select('property_id,outcome')
        .eq('org_id', org_id)
        .in('property_id', chunk);
      if (ie) throw new Error(ie.message);
      for (const row of inter || []) {
        worked.add((row as any).property_id);
        const o = String((row as any).outcome || '').toLowerCase();
        if (o === 'do_not_knock' || o === 'dnk') dnk.add((row as any).property_id);
      }
    }
    let filtered = props || [];
    if (exclude_dnk) filtered = filtered.filter((p: any) => !dnk.has(p.id));
    if (only_unworked) filtered = filtered.filter((p: any) => !worked.has(p.id));
    props = filtered as any;
  }

  const points: DbPoint[] = (props || []).map((p: any) => ({ id: p.id, lat: p.lat, lng: p.lng, value: p.value_estimate }));
  const valueById = new Map<string, number>(points.map((p) => [p.id, Number(p.value || 0)]));
  await updateClusterSet(client, org_id, cluster_set_id, { progress: 10 });

  const clusters = dbscanCluster(points, radius_m, min_houses, (p) => {
    const pct = Math.max(10, Math.min(85, Math.floor(10 + p * 75)));
    client.from('cluster_sets').update({ progress: pct }).eq('id', cluster_set_id).eq('org_id', org_id);
    client.from('jobs_queue').update({ progress: pct }).eq('id', job.id);
  });

  // Clear existing clusters for this set
  await client.from('clusters').delete().eq('org_id', org_id).eq('cluster_set_id', cluster_set_id);
  // Insert clusters in batches
  const insertedClusterIds: string[] = [];
  for (let i = 0; i < clusters.length; i++) {
    const c = clusters[i];
    let total_value = 0;
    for (const pid of c.memberPropertyIds) total_value += (valueById.get(pid) || 0);
    const avg_value = c.memberPropertyIds.length ? total_value / c.memberPropertyIds.length : 0;
    const row = {
      org_id,
      cluster_set_id,
      center_lat: c.center.lat,
      center_lng: c.center.lng,
      hull_geojson: { type: 'Polygon', coordinates: [[...c.hull.map((p) => [p.lng, p.lat]), [c.hull[0].lng, c.hull[0].lat]]] },
      // keep both legacy keys (total_value/avg_value) and the UI keys (total_potential/avg_value_estimate)
      stats_json: {
        size: c.memberPropertyIds.length,
        total_value,
        avg_value,
        total_potential: total_value,
        avg_value_estimate: avg_value
      },
      color: pickColor(i)
    };
    const { data: inserted, error: iErr } = await client.from('clusters').insert(row).select('id').single();
    if (iErr) throw new Error(iErr.message);
    insertedClusterIds.push(inserted!.id);

    // mapping
    const pairs = c.memberPropertyIds.map((pid) => ({ org_id, cluster_id: inserted!.id, property_id: pid }));
    // Supabase has max payload size; batch 1000
    for (let j = 0; j < pairs.length; j += 1000) {
      await client.from('cluster_properties').insert(pairs.slice(j, j + 1000));
    }

    if (i % 5 === 0) {
      const pct = Math.floor(85 + (i / Math.max(1, clusters.length)) * 14);
      await updateClusterSet(client, org_id, cluster_set_id, { progress: pct });
      await client.from('jobs_queue').update({ progress: pct }).eq('id', job.id);
    }
  }

  await updateClusterSet(client, org_id, cluster_set_id, { status: 'complete', progress: 100 });
  await client.from('jobs_queue').update({ progress: 100 }).eq('id', job.id);

  return { ok: true, cluster_set_id, clusters: clusters.length, properties: points.length };
}

async function processExportSales(client: SupabaseClient, job: any) {
  const { org_id } = job;
  const export_id = job.payload?.export_id as string;
  const format = (job.payload?.format as string) || 'csv';
  if (!org_id || !export_id) throw new Error('missing');

  await client.from('exports').update({ status: 'running' }).eq('id', export_id).eq('org_id', org_id);

  // Use the denormalized view so exports include customer + address + derived pipeline status.
  // (Web and API never query Supabase directly from the browser; worker uses service role.)
  const { data: rows, error } = await client
    .from('sales_view')
    .select(
      'id,rep_id,rep_name,address1,city,state,zip,price,service_type,sale_status,pipeline_status,customer_name,customer_phone,customer_email,created_at,updated_at'
    )
    .eq('org_id', org_id)
    .limit(200000);

  if (error) throw new Error(error.message);

  let body: Buffer;
  let contentType = 'text/csv';
  let ext = 'csv';
  if (format === 'json') {
    body = Buffer.from(JSON.stringify(rows || [], null, 2), 'utf8');
    contentType = 'application/json';
    ext = 'json';
  } else {
    body = Buffer.from(stringify(rows || [], { header: true }), 'utf8');
  }

  const path = `${org_id}/exports/sales_${new Date().toISOString().slice(0,10)}_${export_id}.${ext}`;

  const up = await client.storage.from('exports').upload(path, body, { upsert: true, contentType });
  if (up.error) throw new Error(up.error.message);

  await client.from('exports').update({ status: 'complete', storage_path: path }).eq('id', export_id).eq('org_id', org_id);
  return { ok: true, export_id, path };
}

async function processExportAssignments(client: SupabaseClient, job: any) {
  const { org_id } = job;
  const export_id = job.payload?.export_id as string;
  const format = (job.payload?.format as string) || 'csv';
  const cluster_set_id = job.payload?.cluster_set_id as (string | undefined);
  if (!org_id || !export_id) throw new Error('missing');

  await client.from('exports').update({ status: 'running' }).eq('id', export_id).eq('org_id', org_id);

  let q = client
    .from('clusters')
    .select('id,cluster_set_id,assigned_rep_id,center_lat,center_lng,stats_json,created_at')
    .eq('org_id', org_id);
  if (cluster_set_id) q = q.eq('cluster_set_id', cluster_set_id);
  const { data: rows, error } = await q.limit(200000);

  if (error) throw new Error(error.message);

  let body: Buffer;
  let contentType = 'text/csv';
  let ext = 'csv';
  if (format === 'json') {
    body = Buffer.from(JSON.stringify(rows || [], null, 2), 'utf8');
    contentType = 'application/json';
    ext = 'json';
  } else {
    body = Buffer.from(stringify(rows || [], { header: true }), 'utf8');
  }

  const path = `${org_id}/exports/assignments_${new Date().toISOString().slice(0,10)}_${export_id}.${ext}`;

  const up = await client.storage.from('exports').upload(path, body, { upsert: true, contentType });
  if (up.error) throw new Error(up.error.message);

  await client.from('exports').update({ status: 'complete', storage_path: path }).eq('id', export_id).eq('org_id', org_id);
  return { ok: true, export_id, path };
}

async function processContractGenerate(client: SupabaseClient, job: any) {
  const { org_id } = job;
  const sale_id = job.payload?.sale_id as string;
  if (!org_id || !sale_id) throw new Error('missing');

  const { data: sale } = await client.from('sales').select('*').eq('org_id', org_id).eq('id', sale_id).single();
  if (!sale) throw new Error('sale not found');

  const { data: prop } = await client.from('properties').select('*').eq('org_id', org_id).eq('id', sale.property_id).single();

  // Find latest signature attachment (if any)
  const { data: sigRow } = await client
    .from('sale_attachments')
    .select('storage_path, created_at')
    .eq('org_id', org_id)
    .eq('sale_id', sale_id)
    .eq('type', 'signature')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let signatureBuf: Buffer | null = null;
  let signaturePath: string | null = sigRow?.storage_path || null;
  if (signaturePath) {
    const dl = await client.storage.from('attachments').download(signaturePath);
    if (!dl.error && dl.data) {
      // dl.data is a Blob in node; convert to Buffer
      const ab = await (dl.data as any).arrayBuffer();
      signatureBuf = Buffer.from(ab);
    }
  }

  // Build PDF
  const doc = new PDFDocument({ size: 'LETTER', margin: 48 });
  const chunks: Buffer[] = [];
  doc.on('data', (d) => chunks.push(d));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  doc.fontSize(20).text('Block Service Agreement', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Sale ID: ${sale.id}`);
  doc.text(`Customer Phone: ${sale.customer_phone || 'N/A'}`);
  doc.text(`Customer Email: ${sale.customer_email || 'N/A'}`);
  doc.text(`Service: ${sale.service_type || 'N/A'}`);
  doc.text(`Price: ${sale.price != null ? '$' + sale.price : 'N/A'}`);
  if (sale.notes) {
    doc.moveDown(0.5);
    doc.text(`Notes: ${sale.notes}`);
  }
  doc.moveDown();
  doc.text('Property:');
  doc.text(`${prop?.address1 || ''}`);
  doc.text(`${prop?.city || ''} ${prop?.state || ''} ${prop?.zip || ''}`);
  doc.moveDown();
  doc.text('Terms:');
  doc.text('1) Customer agrees to pay for services rendered.');
  doc.text('2) Photos may be taken before and after.');
  doc.text('3) Satisfaction and rework policy as agreed by provider.');
  doc.moveDown();

  doc.text('Signature:');
  if (signatureBuf) {
    const y = doc.y + 8;
    // Draw a light box
    doc.rect(72, y, 260, 80).stroke();
    try {
      doc.image(signatureBuf, 80, y + 8, { fit: [244, 64] });
    } catch {
      doc.fontSize(10).text('(signature image could not be rendered)', 80, y + 30);
    }
    doc.moveDown(6);
    doc.fontSize(12);
    doc.text(`Signed at: ${(sigRow?.created_at ? new Date(sigRow.created_at).toLocaleString() : new Date().toLocaleString())}`);
  } else {
    doc.text('____________________________');
    doc.text('Date: ______________________');
  }
  doc.end();

  const pdf = await done;
  const path = `${org_id}/contracts/contract_${sale_id}.pdf`;

  const up = await client.storage.from('contracts').upload(path, pdf, { contentType: 'application/pdf', upsert: true });
  if (up.error) throw new Error(up.error.message);

  await client
    .from('contracts')
    .upsert(
      {
        org_id,
        sale_id,
        pdf_path: path,
        signature_image_path: signaturePath,
        signed_at: sigRow?.created_at || null,
        terms_version: 'v1'
      },
      { onConflict: 'sale_id' }
    );

  return { ok: true, sale_id, path };
}


async function processTwilioSendSms(client: SupabaseClient, job: any) {
  const { org_id } = job;
  const message_id = job.payload?.message_id as string | undefined;
  if (!org_id || !message_id) throw new Error('missing org_id/message_id');

  const { data: msg, error: mErr } = await client
    .from('messages')
    .select('id,thread_id,body,to_phone,from_phone,status')
    .eq('org_id', org_id)
    .eq('id', message_id)
    .single();

  if (mErr || !msg) throw new Error(mErr?.message || 'message not found');

  // Resolve to/from
  let to = String((msg as any).to_phone || '').trim();
  if (!to) {
    const { data: thread } = await client
      .from('message_threads')
      .select('customer_phone')
      .eq('org_id', org_id)
      .eq('id', (msg as any).thread_id)
      .maybeSingle();
    to = String((thread as any)?.customer_phone || '').trim();
  }

  const { data: settings } = await client.from('org_settings').select('twilio_number').eq('org_id', org_id).maybeSingle();
  const from = String((msg as any).from_phone || (settings as any)?.twilio_number || env.TWILIO_NUMBER || '').trim();

  if (!to || !from) {
    await client.from('messages').update({ status: 'failed' }).eq('org_id', org_id).eq('id', message_id);
    return { ok: false, error: 'missing to/from number' };
  }

  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    await client.from('messages').update({ status: 'skipped', from_phone: from, to_phone: to }).eq('org_id', org_id).eq('id', message_id);
    return { ok: true, skipped: true, reason: 'twilio not configured' };
  }

  const clientTwilio = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  const res = await clientTwilio.messages.create({ to, from, body: String((msg as any).body || '') });

  await client
    .from('messages')
    .update({
      status: 'sent',
      twilio_sid: res.sid,
      sent_at: new Date().toISOString(),
      from_phone: from,
      to_phone: to
    })
    .eq('org_id', org_id)
    .eq('id', message_id);

  return { ok: true, sid: res.sid };
}
