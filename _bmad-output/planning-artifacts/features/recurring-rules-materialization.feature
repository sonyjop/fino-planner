Feature: Recurring rule materialization
  A rule-derived planned occurrence is never stored. Every time a month is
  viewed, it is computed fresh from whichever rule versions are currently
  eligible for it. Only completing an occurrence ever creates a real, stored
  transaction. (architecture.md §2.5)

  Scenario: An active rule produces a computed planned occurrence
    Given an active rule that fires on the 5th of every month
    When I view a month it applies to
    Then I see a planned transaction dated the 5th, with that rule's amount and category
    And no transaction record for it exists in storage yet

  Scenario: Revisiting the same month never duplicates the occurrence
    Given I have already viewed a month with an active rule's occurrence
    When I view that same month again, or leave and come back
    Then exactly one occurrence is shown for that rule, not two

  Scenario: A paused rule produces nothing
    Given a rule is paused
    When I view any month it would otherwise apply to
    Then no occurrence appears for it

  Scenario: A cancelled rule produces nothing, ever
    Given a rule is cancelled
    When I view any month, past or future
    Then no occurrence appears for it

  Scenario: Completing a computed occurrence creates the first real record for it
    Given a computed, not-yet-stored planned occurrence
    When I open it, set Status to "Completed", and save
    Then a real transaction is created for the first time, linked to the rule and the version that produced it
    And it appears in the Completed section on every future view of that month

  Scenario: Editing a computed occurrence without completing it is not supported
    Given a computed, not-yet-stored planned occurrence
    When I try to save changes to it while leaving Status as "Planned"
    Then I see a message that this isn't supported yet, and nothing is saved
    And I am told to either complete it or edit the recurring rule instead

  Scenario: Revising a rule's amount updates a still-planned future occurrence
    Given an active rule with amount X, and a future month's occurrence has not been completed
    When I revise the rule's amount to Y, effective on or before that month
    Then viewing that month now shows the occurrence with amount Y, not X

  Scenario: Revising a rule never changes an already-completed transaction
    Given a rule-derived transaction has already been marked completed for a month
    When I revise the rule's amount afterward
    Then that completed transaction keeps its original amount permanently

  Scenario: A revision effective after a month leaves that month on the older version
    Given a rule's amount is X, and I revise it to Y with an effective date that falls after a given month
    When I view that earlier month
    Then it still shows amount X, not Y

  Scenario: A deprecated version still covers the gap before its successor's start date
    Given a rule's version 1 (amount X) is superseded by version 2 (amount Y) effective 4 months from now
    When I view a month between now and version 2's effective date
    Then I see an occurrence using version 1's amount X, not version 2's

  Scenario: A quarterly rule only fires in its scheduled months
    Given a quarterly rule starting in January
    When I view January, April, July, or October
    Then I see an occurrence
    When I view any other month
    Then I see no occurrence for it

  Scenario: An expired rule still shows occurrences up to its end date, not after
    Given a rule's end date has passed and its status is "Expired"
    When I view a month at or before the end date
    Then I still see the occurrence for that month
    When I view a month after the end date
    Then I see no occurrence

  Scenario: Renaming a rule never produces two planned lines for the same month
    Given an active rule has a not-yet-completed occurrence computed for a future month
    When I rename the rule (changing its identity, not just its content)
    Then the original rule becomes "Cancelled" and produces nothing further
    And the renamed rule (a new rule internally) produces exactly one occurrence for that month, under the new name

  Scenario: A transaction already completed under the old name is never duplicated after a rename
    Given a transaction was completed under a rule before it was renamed
    When I view that month after the rename
    Then the completed transaction still shows under the old name
    And the renamed rule does not also produce an occurrence for that same month

  Scenario: An adhoc transaction is unaffected by any of this
    Given a transaction was added manually, with no recurring rule behind it
    Then it is stored normally and appears the same regardless of any rule's state
