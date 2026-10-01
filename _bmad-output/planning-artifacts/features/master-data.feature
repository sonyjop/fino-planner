Feature: Master Data
  The third tab. It holds the vocabulary every transaction and rule is built from,
  in two two-level hierarchies that work the same way:

  - Categories -> sub-categories (e.g. Housing -> House Rent). Fully user-managed.
  - Payment modes -> instruments (e.g. Credit Card -> HDFC Regalia ••4321). The modes
    are a fixed, system-defined list; the instruments under them are user-managed.

  Definitions used throughout:
  - A transaction or rule records only the leaf: the sub-category, and optionally the
    instrument. The parent (category, payment mode) is always derived from the leaf,
    never stored separately, so the two can never disagree.
  - Income/Expense type is chosen on the transaction or rule itself. It is not tied to
    a category or sub-category: any sub-category can be used for either type.
  - Nothing that has ever been used is deleted. Removing it archives it: it disappears
    from pickers, but history keeps showing its real name. Only something never used
    by any transaction or any rule version can be permanently deleted.
  - Transaction status is not Master Data. It is a fixed pair, Planned and Completed,
    defined in code, because the planned/committed math depends on it.
  - Master Data is stored unencrypted (architecture.md §8.1), so it must never hold
    sensitive numbers such as a full card or account number.

  Background:
    Given I am unlocked and on the Master Data screen

  # --- Screen and seed data ---

  Scenario: The screen shows categories and payment modes
    Then I see a "Categories" section listing each active category with its icon, colour and number of active sub-categories
    And a "Payment" section listing every payment mode with its active instruments
    And there is no "Status" section

  Scenario: Starter data is loaded on first run only
    Given the app is opened for the first time on this device
    Then the starter categories exist with their sub-categories (e.g. Housing -> House Rent, Society Maintenance, Property Tax, Home Loan EMI)
    And the six payment modes exist, with a single "Cash" instrument under Cash
    When I change or archive any starter category and reopen the app
    Then my changes are kept and the starter data is not loaded again

  Scenario: The total-categories card counts active categories only
    Given there are 6 active categories and 1 archived category
    Then the total-categories card shows 6

  # --- Categories and sub-categories ---

  Scenario: Adding a category
    When I add a category with a name, an icon and a colour
    Then it appears in the Categories section with 0 sub-categories

  Scenario: A category with no active sub-categories cannot be picked yet
    Given a category has no active sub-categories
    When I open the category picker on a transaction or rule
    Then that category is not offered
    # Transactions and rules record a sub-category, so an empty category has nothing to pick.

  Scenario: Adding a sub-category to a category
    When I open a category and add a sub-category "Water Purifier Service"
    Then it is listed under that category
    And it can be picked on transactions and rules straight away, without reloading the app

  Scenario: Names must be unique among siblings
    Given the category "Essentials" has an active sub-category "Grocery"
    When I try to add another sub-category "grocery" to Essentials
    Then I see "A sub-category with this name already exists in Essentials"
    And nothing is added
    # The same rule applies to category names, and to instrument nicknames within a payment mode.

  Scenario: The same sub-category name can exist under different categories
    Given "Essentials" has a sub-category "Insurance"
    When I add a sub-category "Insurance" to "Protection"
    Then both exist, and pickers show them as "Essentials › Insurance" and "Protection › Insurance"

  Scenario: Renaming or recolouring shows everywhere, including history
    Given past transactions and rules use the sub-category "OTT/Streaming Subscriptions" under "Lifestyle"
    When I rename it to "Streaming" and recolour Lifestyle
    Then those past transactions, rules and the Annual Summary show "Streaming" and the new colour

  Scenario: A sub-category cannot be moved to another category
    When I open a sub-category
    Then there is no way to change its parent category
    # Moving it would silently re-file its history under a different category.
    # To re-file, archive it and create a new sub-category under the right category.

  # --- Picking a sub-category on a transaction or rule ---

  Scenario: Picking a sub-category records only the sub-category
    When I create a transaction and pick "Housing › House Rent"
    Then the transaction stores the sub-category House Rent
    And it is reported under the category Housing, derived from that sub-category

  Scenario: Type is independent of the sub-category
    Given the sub-category "Essentials › Electricity & Water"
    When I record an expense with it, and later an income (a refund) with it
    Then both are saved
    And Annual Summary shows Essentials in both its Income and Expense sections

  Scenario: The picker groups sub-categories by category
    When I open the sub-category picker
    Then active sub-categories are listed under their active category headings, in Master Data order
    And archived categories and archived sub-categories are not listed

  # --- Archiving, restoring and deleting ---

  Scenario: Archiving a used sub-category
    Given transactions and a rule already use the sub-category "Domestic Help"
    When I remove it
    Then I am told it is in use and will be archived, not deleted
    And it disappears from the sub-category picker
    And existing transactions and the rule still show "Domestic Help" and still count under its category

  Scenario: A rule using an archived sub-category keeps working
    Given an active rule uses a sub-category that I then archive
    Then the rule keeps producing planned occurrences under that sub-category
    And editing the rule keeps it unless I pick a different, active sub-category

  Scenario: Archiving a category archives its sub-categories
    When I archive the category "Transport"
    Then Transport and all its sub-categories disappear from pickers and from the Categories section
    And past transactions under them still show their names and still count under Transport

  Scenario: Restoring an archived category or sub-category
    Given the sub-category "Domestic Help" is archived
    When I open "Show archived" and restore it
    Then it is offered in pickers again
    # Restoring a sub-category whose category is archived restores the category too.

  Scenario: Something never used can be deleted permanently
    Given the sub-category "Hobbies" has never been used by any transaction or any rule version
    When I remove it
    Then I am offered "Delete permanently"
    And after confirming, it no longer exists anywhere

  Scenario: Something ever used can never be deleted
    Given a sub-category was used once by a transaction that has since been deleted
    And it is still used by an old, superseded rule version
    When I remove it
    Then only "Archive" is offered

  Scenario: Data that points at nothing is shown as Uncategorised
    Given a transaction refers to a sub-category id that does not exist in Master Data
    Then it is shown as "Uncategorised"
    And it still counts in every total
    # With archive-never-delete this only happens with corrupt or imported data.

  # --- Payment modes and instruments ---

  Scenario: The payment modes are a fixed list
    Then the payment modes are exactly: Credit Card, Debit Card, UPI, Net Banking, Cash, Wallet
    And I cannot add, rename, reorder, archive or delete a payment mode

  Scenario: Adding an instrument under a payment mode
    When I add an instrument under "Credit Card" with nickname "HDFC Regalia" and last 4 digits "4321"
    Then it is listed under Credit Card as "HDFC Regalia ••4321"

  Scenario: Last 4 digits are optional but must be exactly 4 digits
    When I add an instrument under "UPI" with nickname "GPay (SBI Savings)" and no digits
    Then it is listed as "GPay (SBI Savings)"
    When I enter "43210" or "43a1" as the last 4 digits
    Then I see "Enter exactly the last 4 digits"

  Scenario: A full card or account number can never be saved
    When I enter a nickname that contains a run of more than 4 digits, such as "Regalia 4532015112830366"
    Then I see "Don't store full card or account numbers — use a nickname and the last 4 digits"
    And nothing is saved

  Scenario: One bank account used in several ways is several instruments
    Given I pay from my SBI Savings account by UPI, by net banking and by its debit card
    Then I add one instrument for each, under UPI, Net Banking and Debit Card
    # Each instrument belongs to exactly one payment mode, so picking it can never leave the mode ambiguous.

  Scenario: The built-in Cash instrument is permanent
    Then the "Cash" instrument under Cash cannot be renamed, archived or deleted
    And I can still add other instruments under Cash if I want, such as "Petty cash box"

  Scenario: Archiving and deleting instruments follows the same rules as sub-categories
    Given the card "Amex ••1005" has been used by past transactions
    When I remove it because the card was closed
    Then it is archived: gone from the instrument picker, still shown on those past transactions
    And an instrument never used by any transaction or rule version can be deleted permanently instead

  # --- Picking an instrument on a transaction or rule ---

  Scenario: Picking an instrument marks the payment mode automatically
    When I create a transaction and pick "HDFC Regalia ••4321"
    Then the transaction stores that instrument
    And shows its payment mode as "Credit Card", derived from the instrument

  Scenario: An instrument is optional
    When I save a planned or completed transaction without picking an instrument
    Then it is saved with no payment information
    # You often don't know which card a planned payment will go on yet.

  Scenario: A rule's instrument carries onto completed occurrences
    Given a rule has the instrument "HDFC Regalia ••4321"
    When I complete one of its occurrences
    Then the instrument is pre-filled with "HDFC Regalia ••4321"
    And I can change it for that transaction only, without changing the rule

  # --- Status is not Master Data ---

  Scenario: Transaction status is a fixed Planned/Completed pair
    When I open a transaction's Status control
    Then the only choices are "Planned" and "Completed"
    And there is no separate status label to pick, and no way to add a status in Master Data
