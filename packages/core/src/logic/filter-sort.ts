import { categorizeExpiration } from './expiration.js';
import type { ApiKeyCredential, CredentialFilter, CredentialSort } from '../types/models.js';

export function filterCredentials(
  credentials: ApiKeyCredential[],
  filter: CredentialFilter
): ApiKeyCredential[] {
  const search = filter.search?.trim().toLowerCase();

  return credentials.filter((credential) => {
    if (search && !credential.name.toLowerCase().includes(search)) {
      return false;
    }

    if (filter.tag && !credential.tags.includes(filter.tag)) {
      return false;
    }

    if (filter.privilege && !credential.privileges.includes(filter.privilege)) {
      return false;
    }

    if (filter.expiration && categorizeExpiration(credential.expiration) !== filter.expiration) {
      return false;
    }

    return true;
  });
}

export function sortCredentials(
  credentials: ApiKeyCredential[],
  sort: CredentialSort
): ApiKeyCredential[] {
  const direction = sort.direction === 'desc' ? -1 : 1;
  const cloned = [...credentials];

  cloned.sort((left, right) => {
    if (sort.field === 'name') {
      return left.name.localeCompare(right.name) * direction;
    }

    if (sort.field === 'expiration') {
      return (Date.parse(left.expiration) - Date.parse(right.expiration)) * direction;
    }

    return (Date.parse(left.created) - Date.parse(right.created)) * direction;
  });

  return cloned;
}

