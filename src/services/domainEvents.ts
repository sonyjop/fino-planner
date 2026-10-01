/**
 * Minimal in-process domain events. Writers (TransactionService, RuleService) emit after a
 * successful local write; derived-data maintainers (FiscalYearSummaryService) subscribe.
 * `emit` awaits every handler in order, so a write only resolves once its derived data is
 * up to date — nothing reads a stale summary right after a save. A failing handler is logged,
 * not rethrown: the primary write has already persisted, so rejecting would only invite a
 * duplicate retry. The derived data catches up on the next write that touches it.
 */
export type DomainEvent =
  /** Every date touched by the write — for an edit, both the old and the new date. */
  | { type: 'transactionsChanged'; dates: string[] }
  | { type: 'rulesChanged' };

type Handler = (event: DomainEvent) => Promise<void>;

const handlers: Handler[] = [];

export const domainEvents = {
  subscribe(handler: Handler): () => void {
    handlers.push(handler);
    return () => {
      const index = handlers.indexOf(handler);
      if (index >= 0) handlers.splice(index, 1);
    };
  },

  async emit(event: DomainEvent): Promise<void> {
    for (const handler of [...handlers]) {
      try {
        await handler(event);
      } catch (error) {
        console.error('Domain event handler failed', event.type, error);
      }
    }
  },
};
