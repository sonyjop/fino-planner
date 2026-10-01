Feature: Transactions
  A transaction's status can move freely between Planned and Completed in
  either direction — not a one-way "mark as paid" — and can be set directly at
  creation time. All edits happen through a bottom sheet.
  a transactiomn should record both planned amount and actual amount.
  A transaction records a sub-category (its category is derived from it) and,
  optionally, a payment instrument (its payment mode is derived from it).
  Status has exactly two values, Planned and Completed. (master-data.feature)

  Background:
    Given I am unlocked and viewing a month in Cashflow

  Scenario: Adding a transaction defaults its date to today
    When I tap "+" without changing the date field
    Then the due date defaults to today's date

  Scenario: Adding a transaction as still-planned (the default)
    When I fill in title, amount, sub-category, and type, leave Status as "Planned", and save
    Then it appears in the Upcoming section

  Scenario: Adding a transaction directly as already-completed
    When I fill in title, amount, sub-category, and type, set Status to "Completed", and save
    Then it appears in the Completed section immediately, with no separate "mark as paid" step
    also it will record its planned amount = 0 and actual amount = the user entered value

  Scenario: Completing a still-planned transaction
    Given a transaction is in the Upcoming section
    When I open it, set Status to "Completed", and save
    Then it moves to the Completed section by recording planned and actual accordingly.
    default actual amount is planned unless user manual changes it.

  Scenario: Undoing a completed transaction back to planned
    Given a transaction is in the Completed section
    When I open it, set Status back to "Planned", and save
    Then it moves back to the Upcoming section

  Scenario: Editing a transaction's date to a different month moves it
    Given a transaction belongs to the currently viewed month
    When I change its date to a date in a different month and save
    Then it no longer appears in the current month's view
    And it appears when I navigate to the new month

  Scenario: Deleting a stored transaction
    Given a transaction already exists as a real record (adhoc, or already completed)
    When I open it and choose Delete
    Then it no longer appears in that month

  Scenario: A rule-derived transaction links back to the rule that produced it
    Given a transaction was produced by, or completed from, a recurring rule
    When I open it
    Then I see "From recurring rule: <name> · v<version>"
    And tapping that link opens the rule's edit sheet
