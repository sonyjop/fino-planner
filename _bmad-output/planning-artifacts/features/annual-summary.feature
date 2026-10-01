Feature: Annual summary
  A fourth tab summarising one financial year (April to March). It shows how
  much is planned for the year and how much has been committed so far, as a
  yearly figure, a month-by-month table, and a table per category.

  Definitions used throughout:
  - Planned   = everything completed out of planned - both rule based and adhoc planning.
  - Committed = completed (actual) transactions only.
  Net = income minus expense, for planned and for committed separately.
  Figures are computed each time there is change in rule/cashflow based on event driven. Everytime screen shows information 
  from financial year summary document from DB.
  (architecture.md §2.5, §7)
  
  Background:
    Given I am unlocked and on the Annual Summary screen

  # --- Financial year selection ---

  Scenario: The screen opens on the current financial year
    Given today is 28 September 2026
    Then the selector shows "FY 2026–27"
    And the figures cover 1 April 2026 to 31 March 2027

  Scenario: January to March belong to the financial year that started the previous April
    Given today is 15 February 2027
    Then the selector shows "FY 2026–27"

  Scenario: Moving between financial years with the chevrons
    When I tap the "next year" chevron
    Then the selector shows "FY 2027–28" and all figures cover April 2027 to March 2028
    When I tap the "previous year" chevron twice
    Then the selector shows "FY 2025–26"

  Scenario: Navigating away and back keeps the selected financial year
    Given I have moved to a financial year other than the current one
    When I switch to another tab and back to Annual Summary
    Then I am still viewing the financial year I had selected

  # --- What counts as planned and committed ---

  Scenario: Rule occurrences count as planned for every month they fall in
    Given an active rule of 1,000 expense on the 5th of every month, starting before this financial year and never ending
    And none of its occurrences in this financial year have been completed
    Then planned expense for the year includes 12,000
    And committed expense for the year includes nothing from that rule

  Scenario: Saved planned (adhoc) transactions count as planned only
    Given a saved planned expense of 5,000 in June
    Then planned expense for June and for the year both include 5,000
    And committed expense does not include it

  Scenario: A completed rule occurrence counts once, in both planned and committed
    Given an active monthly rule of 1,000 expense
    And its July occurrence has been completed for 800
    Then planned expense for July includes 1,000 once
    And committed expense for July includes 800.

  Scenario: A completed amount that differs from the rule replaces the rule amount in planned
    Given an active monthly rule of 1,000 expense
    And its August occurrence was completed for 1,200
    Then planned expense for August includes 1,000 from that rule - take value from planned amount
    And committed expense for August includes 1,200 - take value from actual amount.

  Scenario: An unplanned transaction completed directly adds only to committed
    Given a transaction of 3,000 expense created directly as completed in October, with no rule and no earlier plan
    Then planned expense for October includes 0
    And committed expense for October includes 3,000

  Scenario: Moving a transaction back from completed to planned removes it from committed only
    Given a completed expense of 2,000 in November
    When I change its status back to Planned
    Then committed expense for November drops by 2,000
    And planned expense for November is unchanged

  Scenario: A past-month rule occurrence that was never completed still counts as planned
    Given today is in December
    And a rule's May occurrence was never completed
    Then planned expense for May still includes that occurrence
    And committed expense for May does not

  Scenario: Paused and cancelled rules contribute nothing
    Given a rule is paused, and another rule is cancelled
    Then neither contributes to planned in any month of the year

  Scenario: A rule that starts or ends mid-year only counts its own months
    Given an active monthly rule that starts on 1 September and ends on 31 December of this financial year
    Then planned includes its occurrences for September to December only

  Scenario: A new rule version is counted with the right amount for each month
    Given a monthly rule of 1,000 was revised to 1,100 effective 1 October
    Then planned includes 1,000 for April to September and 1,100 for October to March from that rule
    And no month counts both versions

  Scenario: Quarterly and yearly rules fall only in the months they fire
    Given an active quarterly rule of 3,000 that starts in April
    And an active yearly rule of 12,000 that fires in January
    Then planned includes 3,000 in April, July, October and January only
    And 12,000 in January only

  Scenario: Transactions are bucketed by their date
    Given a transaction dated 31 March 2027 and another dated 1 April 2027
    Then the first counts in March of FY 2026–27
    And the second counts in April of FY 2027–28

  # --- Yearly figure ---

  Scenario: The yearly totals card
    Then I see, for the whole financial year:
      | Row     | Planned                        | Committed                        |
      | Income  | total planned income           | total committed income           |
      | Expense | total planned expense          | total committed expense          |
      | Net     | planned income − planned expense | committed income − committed expense |

  Scenario: The yearly totals equal the sum of the months
    Then every yearly figure equals the sum of the same figure across the twelve months in the monthwise table

  Scenario: A negative net is shown clearly as negative
    Given planned expense for the year is greater than planned income
    Then planned net is shown with a minus sign and in the expense colour

  # --- Monthwise split ---

  Scenario: The monthwise table lists all twelve months in financial-year order
    Then I see one row per month from April to March, labelled with month and year (e.g. "Apr 2026" … "Mar 2027")
    And a final "FY total" row
    And each row shows planned and committed for income and for expense, and planned and committed net

  Scenario: Months with no activity still appear
    Given nothing is planned or completed in February
    Then the February row is shown with zeros, not hidden

  Scenario: The current month is highlighted
    Given the selected financial year contains today
    Then the row for the current month is visually highlighted

  Scenario: Tapping a month opens it on the Cashflow screen
    When I tap the "Aug 2026" row
    Then the Cashflow tab opens showing August 2026

  Scenario: The table fits a phone screen
    Given I am on a phone-width screen
    Then the monthwise table is readable without zooming, using compact amounts where needed
    And the month column stays visible if the table scrolls sideways

  # --- Category split ---

  Scenario: The category table shows one row per top-level category
    Then I see a category table with one row per category from Master Data (e.g. Housing, Essentials, Income)
    And each row shows that category's planned and committed amounts for the financial year
    And a category's amounts are the sum of all its sub-categories, including archived ones

  Scenario: Archived categories still appear for years they were used in
    Given the category "Transport" was archived after being used in this financial year
    Then Transport still appears in the category table with its name, icon and colour

  Scenario: Income and expense categories are shown separately
    Given a category has both income and expense transactions in the year
    Then its income and its expense are shown in separate sections, "Income" and "Expense"
    And each section has its own total row

  Scenario: Category section totals match the yearly totals
    Then the total of the Expense section equals the yearly planned and committed expense
    And the total of the Income section equals the yearly planned and committed income

  Scenario: Categories are ordered by planned amount
    Then within each section, categories are listed from the largest planned amount to the smallest

  Scenario: Categories with nothing planned or committed are left out
    Given a category has no planned and no committed amount in the selected financial year
    Then it does not appear in the category table

  Scenario: A category's share of the section is shown
    Then each category row shows its planned amount as a percentage of its section's planned total

  Scenario: Categories use their Master Data name, icon and colour
    Given I rename or recolour a category in Master Data
    Then the category table shows the new name and colour the next time I open the summary

  Scenario: A transaction whose sub-category does not exist is still counted
    Given a transaction or rule refers to a sub-category id that does not exist in Master Data
    Then its amount appears under an "Uncategorised" row
    And the section totals still match the yearly totals

  # --- Empty and loading states ---

  Scenario: A financial year with no data
    Given nothing is planned or completed in the selected financial year
    Then the yearly card shows zeros
    And the monthwise table shows all twelve months with zeros
    And the category table shows a short "Nothing planned for this year yet" message instead of rows

  Scenario: Figures update after changes elsewhere
    Given I add, complete or delete a transaction, or change a rule
    When I return to the Annual Summary tab
    Then every figure reflects that change without reloading the app
