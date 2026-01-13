export const PosthogEvents = {
  ORG_LOGIN: 'org_login',
  ORG_LOGOUT: 'org_logout',
  INVITE_CREATED: 'invite_created',
  INVITE_ACCEPTED: 'invite_accepted',
  CLUSTERSET_CREATED: 'clusterset_created',
  CLUSTERSET_COMPLETED: 'clusterset_completed',
  CLUSTER_ASSIGNED: 'cluster_assigned',
  CONTRACT_SIGNED: 'contract_signed',
  INTERACTION_LOGGED: 'interaction_logged',
  SALE_CREATED: 'sale_created',
  CONTRACT_GENERATED: 'contract_generated',
  MESSAGE_SENT: 'message_sent',
  JOB_STARTED: 'job_started',
  JOB_COMPLETED: 'job_completed',
  PAYMENT_LINK_CREATED: 'payment_link_created',
  PAYMENT_CONFIRMED: 'payment_confirmed'
} as const;
