import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contract = JSON.parse(readFileSync('contracts/arsc-shared-identity.v1.json', 'utf8'));
const authContext = readFileSync('src/contexts/AuthContext.tsx', 'utf8');
const secureAuth = readFileSync('src/lib/supabase/secure-route.ts', 'utf8');
const linkRoute = readFileSync('src/app/api/secure/profile/link-rapor/route.ts', 'utf8');
const avatarRoute = readFileSync('src/app/api/secure/profile/avatar/route.ts', 'utf8');

assert.equal(contract.version, 1);
assert.equal(contract.auth.provider, 'Supabase Auth');
assert.equal(contract.auth.canonicalKey, 'auth.users.id');
assert.equal(contract.projections.haloProfile, 'public.users.id');
assert.equal(contract.projections.leaderboardProfile, 'public.profiles.user_id');
assert.equal(contract.verification.linkRpc, 'public.link_arsc_account_from_reference');

assert.match(authContext, /supabase\.auth\.signInWithPassword/);
assert.match(authContext, /supabase\.auth\.signUp/);
assert.match(authContext, /\.from\("users"\)/);
assert.match(secureAuth, /authClient\.auth\.getUser/);
assert.match(linkRoute, /RAPOR_ACCESS_CODE_PEPPER/);
assert.match(linkRoute, /link_arsc_account_from_reference/);
assert.match(linkRoute, /rapor_access_codes/);
assert.match(avatarRoute, /set_shared_profile_avatar/);

process.stdout.write('Halo PSDM shared identity contract passed.\n');
