Feature: Recurring rule lifecycle
  A recurring rule's content (name, category, type, amount, schedule, end date)
  is immutable — every content edit produces a new version. Status
  (active/paused/cancelled/deprecated/expired) is the one exception: it
  mutates in place and never creates a version.

  Scenario: Creating a rule
    When I fill in name, amount, category, type, cadence, schedule, and start date, then save
    Then a new rule is created as version 1 with status "Active"

  Scenario: Choosing a monthly cadence
    Given I am creating or editing a rule
    When I set Repeats to "Monthly" and a day of month
    Then the rule fires on that day every month

  Scenario: Choosing a quarterly cadence
    Given I am creating or editing a rule
    When I set Repeats to "Quarterly", a start month, and a day of month
    Then the rule fires on that day every 3rd month counting from the start month

  Scenario: Choosing a yearly cadence
    Given I am creating or editing a rule
    When I set Repeats to "Yearly", a month, and a day of month
    Then the rule fires on that day once a year, in that month

  Scenario: A never-ending rule has no end date
    Given I am creating or editing a rule
    When I leave Duration set to "Never ending"
    Then the rule has no configured end date

  Scenario: A rule with a configured end date
    Given I am creating or editing a rule
    When I set Duration to "Has an end date" and pick a date
    Then the rule will not produce occurrences for any month after that date

  Scenario: Editing amount or schedule creates a new version, same rule
    Given a rule exists at version 1
    When I change its amount (or day of month, or cadence) and save
    Then a new version 2 is created with the same rule identity
    And version 1's status becomes "Deprecated"
    And version 2 inherits version 1's pre-edit status as its own starting status

  Scenario: Editing name, category, or type creates a brand-new rule
    Given a rule exists at version 1
    When I change its name (or category, or type) and save
    Then a brand-new rule is created at version 1
    And the original rule's current version becomes "Cancelled"
    And the new rule inherits the original's pre-edit status

  Scenario: Pausing a rule does not create a new version
    Given an active rule
    When I choose "Pause"
    Then its status becomes "Paused" in place
    And its version number is unchanged

  Scenario: Resuming a paused rule
    Given a paused rule
    When I choose "Resume"
    Then its status becomes "Active" in place

  Scenario: Pausing and resuming leaves no trace in version history
    Given a rule at version 1 is paused and then resumed
    Then its version history still shows only version 1 — no new entries from the pause/resume

  Scenario: Cancelling a rule directly
    Given an active or paused rule
    When I choose "Cancel rule"
    Then its status becomes "Cancelled" in place

  Scenario: A rule automatically expires once its end date passes
    Given a rule has a configured end date that is now in the past
    When the Rules screen (or anything that lists rules) is loaded
    Then that rule's status is updated to "Expired"

  Scenario: A never-ending rule never expires
    Given a rule has no configured end date
    Then its status never automatically becomes "Expired", no matter how much time passes

  Scenario: Deleting a rule removes its whole version history
    Given a rule with two or more versions
    When I choose "Delete rule"
    Then every version of that rule is permanently removed
    But any transaction already completed under it keeps its rule reference for history
