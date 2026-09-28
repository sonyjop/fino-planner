Feature: Local passphrase lock and encryption at rest
  The app gates all local data behind a passphrase. The derived encryption key
  lives only in memory for the session and is never persisted, so every reload
  re-locks the app. (architecture.md §8)

  Scenario: First run prompts to set a passphrase
    Given no passphrase has ever been set on this device
    When the app loads
    Then I see a "Set a passphrase" screen with a passphrase field and a confirm field

  Scenario: Setting a passphrase unlocks the app
    Given I am on the "Set a passphrase" screen
    When I enter the same passphrase in both fields and submit
    Then the app unlocks and shows the Cashflow screen

  Scenario: A returning session asks to unlock, not set up
    Given a passphrase has already been set on this device
    When the app loads
    Then I see an "Enter your passphrase" screen with a single passphrase field

  Scenario: Reloading the page always re-locks the app
    Given I have unlocked the app in this browser tab
    When I reload the page
    Then I am asked to enter my passphrase again

  Scenario: An incorrect passphrase is rejected
    Given a passphrase has already been set on this device
    When I enter an incorrect passphrase and submit
    Then I see an "Incorrect passphrase" error
    And the app remains locked

  Scenario: The correct passphrase unlocks after a prior failed attempt
    Given I just entered an incorrect passphrase
    When I enter the correct passphrase and submit
    Then the app unlocks and shows the Cashflow screen
