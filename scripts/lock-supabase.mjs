// Changes only admission settings, never workspace rows or Auth users.
import { configureSingleOwnerAuth } from './supabase-admission.mjs';
import { createManagementClient } from './supabase-management.mjs';

const management = createManagementClient();
try {
  await configureSingleOwnerAuth(management.request);
} finally {
  await management.close();
}
