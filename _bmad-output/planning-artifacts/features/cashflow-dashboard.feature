Feature: Cashflow dashboard
  The home screen shows a selected month's projected balance, an income/expense
  summary, and that month's transactions split into Upcoming and Completed.

  Background:
    Given I am unlocked and on the Cashflow screen

  Scenario: Navigating months with the chevrons
    When I tap the "next month" chevron
    Then the screen shows the following calendar month
    When I tap the "previous month" chevron
    Then the screen shows the prior calendar month again

  Scenario: Jumping to an arbitrary month with the date picker
    When I tap the month label and pick a date in a different month
    Then the screen shows that month

  Scenario: Navigating away and back preserves the selected month
    Given I have navigated to a month other than the current calendar month
    When I switch to another tab and back to Cashflow
    Then I am still viewing the month I had selected, not reset to the current calendar month

  Scenario: Actual is the prominent figure, Planned is the subtext
    Given the selected month has both completed and still-planned transactions
    Then each summary card (Income, Expenses) shows the actual (completed) total as the large figure
    And shows "Planned <total>" as the smaller subtext, where the total includes both planned and completed amounts

  Scenario: Projected balance is income minus expenses for the whole month
    Given the selected month's total income is X and total expenses is Y
    Then the projected balance shown is X minus Y

  Scenario: A still-planned transaction appears under Upcoming
    Given a transaction for the selected month has not been marked completed
    Then it appears in the "Upcoming" section

  Scenario: A completed transaction appears under Completed
    Given a transaction for the selected month has been marked completed
    Then it appears in the "Completed" section

  Scenario: Upcoming and Completed scroll independently
    Given a month has more transactions than fit on screen in one section
    Then that section scrolls on its own without moving the header or balance card
