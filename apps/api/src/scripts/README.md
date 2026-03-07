# API scripts

## Adding an organization

- **`pnpm run seed:client`** – Interactive: creates an org, default Hendricks county, and admin/manager/rep/labor accounts. Run from `apps/api`.

## Why no properties for my test org?

Creating an org (or manually adding a county row) only links the org to a county. **Properties** are stored in the `properties` table per `org_id` and `county_id`. A new org has no property rows, so:

- **Cluster generation** (Create a cluster set) finds no properties in that county for that org.
- **Draw zones** find no properties inside the polygon for that org.

To populate properties for your test org:

1. Get your org id (e.g. from the seed:client output, or from Supabase `organizations` table).
2. Set the CSV path and run the Hendricks import for that org:

   ```bash
   cd apps/api
   ORG_ID=<your-org-uuid> HENDRICKS_CSV_PATH=./path/to/hendricks.csv pnpm run import:hendricks
   ```

   Use `--replace` to replace existing properties for that org+county:

   ```bash
   ORG_ID=<your-org-uuid> HENDRICKS_CSV_PATH=./path/to/hendricks.csv pnpm run import:hendricks -- --replace
   ```

After the import, cluster generation and draw zones will show properties for that org.
