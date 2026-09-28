Feature: Recurring rules screen
  Lists rules with search and status filtering, shows enough at a glance to
  understand a rule's current state, and lets you inspect (but not edit) its
  version history.

  Scenario: The version number is visible at a glance
    Given a rule is on its 2nd version
    Then the Rules list shows "v2" next to its name
    And the edit sheet's title shows "v2" too

  Scenario: Searching rules by name
    When I type part of a rule's name into the search field
    Then only rules whose name contains that text are shown

  Scenario: Filtering by status
    Given rules exist in different statuses
    When I select the "Active" filter chip
    Then only active rules are shown, and the chip shows their count
    # The same applies to the Paused, Cancelled, and Expired chips.

  Scenario: Deprecated is not a filterable status on this screen
    Given a rule has a deprecated (superseded) version somewhere in its history
    Then that version never appears in this list, under any filter
    Because only a lineage's latest version is ever listed here, and a deprecated version is by definition not the latest

  Scenario: Seeing when a rule last executed and is next due
    Given a rule has been completed for some past month
    Then its row shows "Last: <that date>"
    And shows "Next: <the next computed due date>" if the rule is still active

  Scenario: A rule that has never been completed shows "Never"
    Given a rule has no completed transactions yet
    Then its row shows "Last: Never"

  Scenario: Viewing, not editing, a past version
    Given a rule has one or more previous versions
    When I expand "N previous versions" and tap one
    Then I see that version's details as read-only, with a way to go back to the current version
    And there is no way to edit or delete that historical version
