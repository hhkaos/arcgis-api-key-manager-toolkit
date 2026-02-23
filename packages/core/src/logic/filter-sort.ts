import { categorizeExpiration } from './expiration.js';
import type { ApiKeyCredential, CredentialFilter, CredentialSort } from '../types/models.js';

export function filterCredentials(
  credentials: ApiKeyCredential[],
  filter: CredentialFilter
): ApiKeyCredential[] {
  const search = filter.search?.trim().toLowerCase();

  return credentials.filter((credential) => {
    if (search) {
      const matchesName = credential.name.toLowerCase().includes(search);
      const matchesReferrer = credential.referrers.some((referrer) =>
        referrer.toLowerCase().includes(search)
      );
      const matchesPartialKey = [credential.key1.partialId, credential.key2.partialId]
        .filter((value): value is string => Boolean(value))
        .some((partialId) => partialId.toLowerCase().includes(search));
      if (!matchesName && !matchesReferrer && !matchesPartialKey) {
        return false;
      }
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

    if (filter.favorites && !credential.isFavorite) {
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
