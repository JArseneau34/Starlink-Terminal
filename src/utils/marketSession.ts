import type { MarketSession } from '../types';

export function sessionLabel(session: MarketSession | undefined): string {
  switch (session) {
    case 'pre':
      return 'PRE';
    case 'post':
      return 'AH';
    default:
      return '';
  }
}

export function isExtendedQuote(session: MarketSession | undefined): boolean {
  return session === 'pre' || session === 'post';
}

export function marketSessionTitle(session: MarketSession | undefined): string {
  switch (session) {
    case 'pre':
      return 'Pre-Market';
    case 'post':
      return 'After Hours';
    case 'regular':
      return 'Regular Session';
    default:
      return 'Market Closed';
  }
}
