Feature: Basic Calculator
  As a user
  I want to perform basic arithmetic operations
  So that I can calculate results

  Scenario: Adding two numbers
    Given I have the number 5
    And I have the number 3
    When I add them together
    Then the result should be 8

  Scenario: Multiplying two numbers
    Given I have the number 4
    And I have the number 6
    When I multiply them together
    Then the result should be 24
