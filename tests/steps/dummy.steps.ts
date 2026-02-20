import { defineFeature, loadFeature } from 'jest-cucumber';
import { join } from 'path';

const feature = loadFeature(join(__dirname, '../features/dummy.feature'));

defineFeature(feature, (test) => {
    let firstNumber: number;
    let secondNumber: number;
    let result: number;

    test('Adding two numbers', ({ given, and, when, then }) => {
        given(/^I have the number (\d+)$/, (num: string) => {
            firstNumber = parseInt(num, 10);
        });

        and(/^I have the number (\d+)$/, (num: string) => {
            secondNumber = parseInt(num, 10);
        });

        when('I add them together', () => {
            result = firstNumber + secondNumber;
        });

        then(/^the result should be (\d+)$/, (expected: string) => {
            expect(result).toBe(parseInt(expected, 10));
        });
    });

    test('Multiplying two numbers', ({ given, and, when, then }) => {
        given(/^I have the number (\d+)$/, (num: string) => {
            firstNumber = parseInt(num, 10);
        });

        and(/^I have the number (\d+)$/, (num: string) => {
            secondNumber = parseInt(num, 10);
        });

        when('I multiply them together', () => {
            result = firstNumber * secondNumber;
        });

        then(/^the result should be (\d+)$/, (expected: string) => {
            expect(result).toBe(parseInt(expected, 10));
        });
    });
});
