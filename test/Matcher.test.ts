import {test, expect, describe, beforeEach, mock, jest} from "bun:test";
import { MatchDict, emptyMatchDict } from '../MatchDict';
import { MatchResult, isMatchFailure } from '../MatchResult';
import type { MatchFailure } from "../MatchResult";
import { FailedMatcher, FailedReason } from '../MatchResult';

import {  match_constant, match_element, match_segment, match_segment_independently } from '../MatchCallback';
import type { matcher_callback } from '../MatchCallback';
import { match_array } from '../MatchCombinator';
import { match_choose, match_letrec, match_reference } from "../MatchCombinator";
import { run_matcher } from '../MatchBuilder';
import { match_builder } from "../MatchBuilder";
import { createMatchFailure } from "../MatchResult";
import { flattenNestedMatchFailure } from "../MatchResult";
import { match_all_other_element } from "../MatchCallback";

describe('MatchResult', () => {
    let dictionary: MatchDict;
    let matchResult: MatchResult;

    beforeEach(() => {
        // Create a new dictionary and MatchResult before each test
        dictionary = new MatchDict(new Map([
            ['key1', 10],
            ['key2', 20]
        ]));
        matchResult = new MatchResult(true, dictionary, 2);
    });

    test('do function should apply a callback to the dictionary values', () => {
        // Define a callback that sums numbers
        const sumCallback = (...numbers: number[]) => numbers.reduce((a, b) => a + b, 0);

        // Use the `do` function with the sumCallback
        const result = matchResult.do(sumCallback);

        // Expect the result to be the sum of the values in the dictionary
        expect(result).toBe(30); // 10 + 20
    });

    test('do function should handle callbacks that concatenate strings', () => {
        // Adjust the dictionary for string testing

        const testMatchResult = new MatchResult(true, new MatchDict(new Map([
            ['first', 'Hello, '],
            ['second', 'World!']
        ])), 2);

   

        // Define a callback that concatenates strings
        const concatCallback = (...strings: string[]) => strings.join('');

        // Use the `do` function with the concatCallback
        const result = testMatchResult.do(concatCallback);

        // Expect the result to be a concatenation of the values
        expect(result).toBe('Hello, World!');
    });
});

describe('match_eqv', () => {
    test('should call succeed with correct parameters when match is found', () => {
        const matcher = match_constant("x");
        const mockData = ["x"];
        const mockDictionary = new MatchDict(new Map());
        const mockSucceed = mock();

        matcher(mockData, mockDictionary, mockSucceed);

        expect(mockSucceed).toHaveBeenCalledWith(mockDictionary, 1);
    });

    test('should return MatchFailure when no data is provided', () => {
        const matcher = match_constant("x");
        const mockData : string[] = [];
        const mockDictionary = new MatchDict(new Map());
        const mockSucceed = mock();

        const result = matcher(mockData, mockDictionary, mockSucceed);

        expect(result).toEqual(expect.objectContaining({
            matcher: FailedMatcher.Constant,
            reason: FailedReason.UnexpectedEnd,
            position: 0
        }));
        expect(mockSucceed).not.toHaveBeenCalled();
    });

    test('should return MatchFailure when the first element does not match', () => {
        const matcher = match_constant("x");
        const mockData = ["y"];
        const mockDictionary = new MatchDict(new Map());
        const mockSucceed = mock();

        const result = matcher(mockData, mockDictionary, mockSucceed);

        expect(result).toEqual(expect.objectContaining({
            matcher: FailedMatcher.Constant,
            reason: FailedReason.UnexpectedInput,
            position: 0
        }));
        expect(mockSucceed).not.toHaveBeenCalled();
    });
});

describe('match_element', () => {
    test('should handle variable binding correctly when unbound', () => {
        const matcher = match_element("x");
        const mockData = ["a"];
        const mockDictionary = new MatchDict(new Map());
        const mockSucceed = jest.fn();

        matcher(mockData, mockDictionary, mockSucceed);

        expect(mockSucceed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(mockSucceed.mock.calls[0][0].get("x")).toBe("a");
    });

    test('should handle variable binding correctly when already bound to the same value', () => {
        const matcher = match_element("x");
        const mockData = ["a"];
        const mockDictionary = new MatchDict(new Map([["x", "a"]]));
        const mockSucceed = jest.fn();

        matcher(mockData, mockDictionary, mockSucceed);

        expect(mockSucceed).toHaveBeenCalledWith(mockDictionary, 1);
    });

    test('should return MatchFailure when already bound to a different value', () => {
        const matcher = match_element("x");
        const mockData = ["b"];
        const mockDictionary = new MatchDict(new Map([["x", "a"]]));
        const mockSucceed = jest.fn();

        const result = matcher(mockData, mockDictionary, mockSucceed);

        expect(result).toEqual(expect.objectContaining({
            matcher: FailedMatcher.Element,
            reason: FailedReason.BindingValueUnmatched,
            position: 0
        }));
        expect(mockSucceed).not.toHaveBeenCalled();
    });
});

describe('match_segment', () => {
    test('should handle segment matching correctly when unbound', () => {
        const matcher = match_segment("segment");
        const mockData = ["hello", "world"];
        const mockDictionary = new MatchDict(new Map());
        const mockSucceed = jest.fn((result: any) => {
            return createMatchFailure(FailedMatcher.Segment, FailedReason.UnexpectedEnd, mockData, 0, null) 
        });

        matcher(mockData, mockDictionary, mockSucceed);

        expect(mockSucceed).toHaveBeenCalledTimes(2);
        expect(mockSucceed.mock.calls[1][0].get("segment")).toEqual(["hello", "world"]);
        expect(mockSucceed).toHaveBeenCalledWith(expect.any(MatchDict), 2);
    });

    test('should handle segment matching correctly when already bound to the same value', () => {
        const matcher = match_segment("segment");
        const mockData = ["hello", "world"];
        const mockDictionary = new MatchDict(new Map([["segment", ["hello", "world"]]]));
        const mockSucceed = jest.fn();

        matcher(mockData, mockDictionary, mockSucceed);

        expect(mockSucceed).toHaveBeenCalledWith(mockDictionary, 2);
    });

    test('should return MatchFailure when already bound to a different value', () => {
        const matcher = match_segment("segment");
        const mockData = ["different", "input"];
        const mockDictionary = new MatchDict(new Map([["segment", ["hello", "world"]]]));
        const mockSucceed = jest.fn();

        const result = matcher(mockData, mockDictionary, mockSucceed);

        expect(result).toEqual(expect.objectContaining({
            matcher: FailedMatcher.Segment,
            reason: FailedReason.BindingValueUnmatched,
            position: 0
        }));
        expect(mockSucceed).not.toHaveBeenCalled();
    });
});

describe('match_list with complex patterns', () => {
    test("should success when matching empty array", () => {
        const matcher = match_array([]);
        const data: any[] = [];
        const dictionary = new MatchDict(new Map());
        const succeed = jest.fn();

        matcher(data, dictionary, succeed);
        expect(succeed).toHaveBeenCalledWith(dictionary, 0);
    })


    test('should handle pattern with constants and a segment', () => {
        // Matchers for the scenario
        const matchX = match_constant("x");
        const matchSegment = match_segment("segment");

        // Create the match_list for the pattern [match_constant, match_segment]
        const pattern = match_array([matchX, matchSegment]);

        // Define the test data and dictionary
        const testData = [["x", "hello", "world"]];
        const dictionary = new MatchDict(new Map());

        // Define a mock succeed function
        const mockSucceed = jest.fn((dictionary: MatchDict, nEaten: number) => true);

        // Execute the matcher
        const result = pattern(testData, dictionary, mockSucceed);

        // Check if the succeed function was called correctly
        expect(mockSucceed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        // console.log("result=" + result)
        expect(result).toBe(true);
        expect(mockSucceed.mock.calls[0][0].get("segment")).toEqual(["hello", "world"]);
    });

    test('should handle pattern with constants and a segment including a trailing constant', () => {
        // Matchers for the scenario
        const matchX = match_constant("x");
        const matchSegment = match_segment("segment");
        const matchY = match_constant("y");

        // Create the match_list for the pattern [match_constant, match_segment, match_constant]
        const pattern = match_array([matchX, matchSegment, matchY]);

        // Define the test data and dictionary
        const testData = [["x", "hello", "world", "y"]];
        const dictionary = new MatchDict(new Map());

        // Define a mock succeed function
        const mockSucceed = jest.fn((dictionary: MatchDict, nEaten: number) => true);

        // Execute the matcher
        const result = pattern(testData, dictionary, mockSucceed);

        // Check if the succeed function was called correctly
        expect(mockSucceed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toBe(true);
        expect(mockSucceed.mock.calls[0][0].get("segment")).toEqual(["hello", "world"]);
    });

    test('should return MatchFailure for mismatched patterns', () => {
        // Matchers setup
        const matchX = match_constant("x");
        const matchSegment = match_segment("segment");
        const matchY = match_constant("y");

        // Create the match_list for the pattern [match_constant, match_segment, match_constant]
        const pattern = match_array([matchX, matchSegment, matchY]);

        // Define test data that does not match the pattern
        const mismatchedData = [["x", "hello", "oops", "z"]];  // "z" should be "y"
        const dictionary = new MatchDict(new Map());

        // Define a mock succeed function
        const mockSucceed = jest.fn((dictionary: MatchDict, nEaten: number) => true);

        // Execute the matcher
        const result = pattern(mismatchedData, dictionary, mockSucceed);

        // Check if the result is false and succeed function was not called
        expect(result).toEqual(expect.objectContaining({
            matcher: FailedMatcher.Array,
            reason: FailedReason.UnexpectedInput,
            position: 0
        }));
        expect(mockSucceed).not.toHaveBeenCalled();
    });



describe('Nested Array Matching Tests', () => {
    test('matches simple nested array structure', () => {
        const nested_matcher_test = match_array([
            match_constant("a"),
            match_constant("b"),
            match_array([
                match_array([
                    match_element("symbol"),
                    match_constant("d")
                ])
            ])
        ]);

        const result = nested_matcher_test([["a", "b", [["c", "d"]]]], new MatchDict(new Map()), (dict, nEaten) => {
            return dict;
        });

        expect(result).not.toBe(false); // Adjust according to what you expect to receive
    });

    test('handles deeper nested arrays', () => {
        const nested_matcher_test = match_array([
            match_constant("a"),
            match_array([
                match_array([
                    match_element("symbol"),
                    match_constant("d")
                ])
            ]),
            match_constant("b")
        ]);

        const result = nested_matcher_test([["a", [["c", "d"]], "b"]], new MatchDict(new Map()), (dict, nEaten) => {
            return dict;
        });

        expect(result).not.toBe(false); // Adjust according to what you expect to receive
    });

});

});

describe('match_builder with run_matcher', () => {
  test('should handle constant patterns correctly', () => {
    const matcher = match_builder(["a", "b", "c"]);
    const data = ["a", "b", "c"];
    const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

    run_matcher(matcher, data, succeed);

    expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
  });

  test('should handle nested array patterns correctly', () => {
    const matcher = match_builder([[["a", "b"], "c"]]);
    const data = [[["a", "b"], "c"]];
    const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

    run_matcher(matcher, data, succeed);

    expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
  });

  test('should handle element matchers correctly', () => {
    const matcher = match_builder([[match_element("x"), "b"]]);
    const data = [["value", "b"]];
    const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

    run_matcher(matcher, data, succeed);

    expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
    expect(succeed.mock.calls[0][0].get("x")).toEqual("value");
  });

  test('should return MatchFailure when patterns do not match', () => {
    const matcher = match_builder(["a", "b"]);
    const data = ["a", "c"];
    const succeed = jest.fn();

    const result : MatchFailure | MatchDict = run_matcher(matcher, data, succeed);

    const failures = flattenNestedMatchFailure(result as MatchFailure)

    expect(failures[1]).toEqual(expect.objectContaining({
        matcher: FailedMatcher.Array,
        reason: FailedReason.UnexpectedInput,
        position: 1
    }));
    expect(succeed).not.toHaveBeenCalled();
  });

  test('should handle complex nested patterns', () => {
    const matcher = match_builder([["a", match_segment("seg")], "c"]);
    const data = [["a", "b", "d"], "c"];
    const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

    run_matcher(matcher, data, succeed);

    expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
    expect(succeed.mock.calls[0][0].get("seg")).toEqual(["b", "d"]);
  });
});

describe('match_segment_all', () => {
    test('should succeed when the entire segment matches the restriction', () => {
        const data = [1, 2, 3];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const matcher = match_segment_independently("segment", (value) => typeof value === 'number');
        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), data.length);
        expect(result).toEqual(succeed.mock.results[0].value);
    });

    test('should fail when the segment does not match the restriction', () => {
        const data = [1, 2, 'a'];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn();

        const matcher = match_segment_independently("segment", (value) => typeof value === 'number');
        const result = matcher(data, dictionary, succeed);

        expect(succeed).not.toHaveBeenCalled();
        expect(result).toEqual(createMatchFailure(FailedMatcher.Segment, FailedReason.RestrictionUnmatched, 'a', 2, null));
    });


});


describe('Integration Tests for Matchers', () => {
    test('should match a complex pattern with match_array and match_segment_all', () => {
        const matcher = match_array([
            match_constant("start"),
            match_array([
                match_segment_independently("numbers", (value) => typeof value === 'number'),
            ]),
            match_constant("end")
        ]);

        const data = [["start", [1, 2, 3], "end"]];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
        expect(succeed.mock.calls[0][0].get("numbers")).toEqual([1, 2, 3]);
    });

    test('should match a pattern with match_choose', () => {
        const matcher = match_choose([
            match_constant("a"),
            match_constant("b"),
            match_constant("c")
        ]);

        const data = ["b"];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
    });

    test('should handle nested match_array patterns', () => {
        const matcher = match_array([
            match_constant("a"),
            match_array([
                match_element("x"),
                match_constant("b")
            ]),
            match_constant("c")
        ]);

        const data = [["a", ["value", "b"], "c"]];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
        expect(succeed.mock.calls[0][0].get("x")).toEqual("value");
    });

    test('should fail when pattern does not match', () => {
        const matcher = match_array([
            match_constant("a"),
            match_array([
                match_segment_independently("numbers", (value) => typeof value === 'number'),
            ]),
            match_constant("end")
        ]);

        const data = [["a", [1, "oops"], "end"]];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn();

        const result = matcher(data, dictionary, succeed);

        expect(succeed).not.toHaveBeenCalled();
        expect(isMatchFailure(result)).toBe(true);
    });
});


describe('match_all_other_element', () => {
    test('should succeed without consuming any input when constant in front matches', () => {
        const data = [["constant", 1, 2, 3]];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const matcher = match_array([
            match_constant("constant"),
            match_all_other_element()
        ]);
        const result = matcher(data, dictionary, succeed);
        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
    });

    test('should fail when the constant in front does not match', () => {
        const data = ["wrong_constant", 1, 2, 3];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn();

        const matcher = match_constant("constant");
        const result = matcher(data, dictionary, (new_dict, nEaten) => {
            return match_all_other_element()(data.slice(nEaten), new_dict, succeed);
        });

        expect(succeed).not.toHaveBeenCalled();
        expect(result).toEqual(createMatchFailure(FailedMatcher.Constant, FailedReason.UnexpectedInput, "wrong_constant", 0, null));
    });

    test('should succeed with empty input when constant in front matches', () => {
        const data = [["constant"]];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const matcher = match_array([
            match_constant("constant"),
            match_all_other_element()
        ]);
        const result = matcher(data, dictionary, succeed);
        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
    });

    test('should fail with empty input when constant in front does not match', () => {
        const data = ["wrong_constant"];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn();

        const matcher = match_constant("constant");
        const result = matcher(data, dictionary, (new_dict, nEaten) => {
            return match_all_other_element()(data.slice(nEaten), new_dict, succeed);
        });

        expect(succeed).not.toHaveBeenCalled();
        expect(result).toEqual(createMatchFailure(FailedMatcher.Constant, FailedReason.UnexpectedInput, "wrong_constant", 0, null));
    });
});


describe('match_all_other_element', () => {
    test('should succeed without consuming any input when constant in front matches', () => {
        const data = [["constant", 1, 2, 3]];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const matcher = match_array([
            match_constant("constant"),
            match_all_other_element()
        ]);
        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
    });

    test('should succeed with pattern ["start", match_all_other_element(), "end"]', () => {
        const data = [["start", 1, 2, 3, "end"]];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const matcher = match_array([
            match_constant("start"),
            match_all_other_element(),
            match_constant("end"),
        ]);

        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
    });

    test('should fail with pattern ["start", match_all_other_element(), "end"] when "start" does not match', () => {
        const data = [["wrong_start", 1, 2, 3, "end"]];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn();

        const matcher = match_constant("start");
        const result = matcher(data, dictionary, (new_dict, nEaten) => {
            return match_all_other_element()(data.slice(nEaten), new_dict, (newer_dict, nEaten2) => {
                return match_constant("end")(data.slice(nEaten + nEaten2), newer_dict, succeed);
            });
        });

        expect(succeed).not.toHaveBeenCalled();
        expect(isMatchFailure(result)).toBe(true);
    });

    test('should fail with pattern ["start", match_all_other_element(), "end"] when "end" does not match', () => {
        const data = ["start", 1, 2, 3, "wrong_end"];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn();

        const matcher = match_constant("start");
        const result = matcher(data, dictionary, (new_dict, nEaten) => {
            return match_all_other_element()(data.slice(nEaten), new_dict, (newer_dict, nEaten2) => {
                return match_constant("end")(data.slice(nEaten + nEaten2), newer_dict, succeed);
            });
        });

        expect(succeed).not.toHaveBeenCalled();
        expect(isMatchFailure(result)).toBe(true);
    });
});


describe('match_all_other_element integrate with matchBuilder', () => {
    test('should match a pattern with match_all_other_element', () => {
        const matcher = match_builder([
            "start", "...", "end"
        ]);

        const data = ["start", "a", "b", "c", "end"];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result: MatchDict | MatchFailure = run_matcher(matcher, data, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
    });
});


describe('match_choose', () => {
    test('should succeed with the first matching constant pattern', () => {
        const matcher = match_choose([
            match_constant("a"),
            match_constant("b"),
            match_constant("c")
        ]);

        const data = ["a"];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
    });

    test('should succeed with the second matching constant pattern', () => {
        const matcher = match_choose([
            match_constant("a"),
            match_constant("b"),
            match_constant("c")
        ]);

        const data = ["b"];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
    });

    test('should fail when no constant patterns match', () => {
        const matcher = match_choose([
            match_constant("a"),
            match_constant("b"),
            match_constant("c")
        ]);

        const data = ["d"];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn();

        const result = matcher(data, dictionary, succeed);

        expect(succeed).not.toHaveBeenCalled();
        expect(result).toEqual(createMatchFailure(FailedMatcher.Choice, FailedReason.UnexpectedEnd, data, 3, null));
    });

    test('should succeed with a more complex pattern', () => {
        const matcher = match_choose([
            match_array([match_constant("a"), match_constant("b")]),
            match_array([match_constant("c"), match_constant("d")])
        ]);

        const data = [["c", "d"]];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
    });

    test('should fail when nested patterns do not match', () => {
        const matcher = match_choose([
            match_array([match_constant("a"), match_constant("b")]),
            match_array([match_constant("c"), match_constant("d")])
        ]);

        const data = [["a", "d"]];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn();

        const result = matcher(data, dictionary, succeed);

        expect(succeed).not.toHaveBeenCalled();
        expect(result).toEqual(createMatchFailure(FailedMatcher.Choice, FailedReason.UnexpectedEnd, data, 2, null));
    });

    test('should succeed with a pattern that includes an element matcher', () => {
        const matcher = match_choose([
            match_constant("a"),
            match_element("x")
        ]);

        const data = ["value"];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
        expect(succeed.mock.calls[0][0].get("x")).toEqual("value");
    });

    test('should succeed with a pattern that includes a segment matcher', () => {
        const matcher = match_choose([
            match_constant("a"),
            match_segment_independently("segment")
        ]);

        const data = ["value1", "value2"];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 2);
        expect(result).toEqual(succeed.mock.results[0].value);
        expect(succeed.mock.calls[0][0].get("segment")).toEqual(["value1", "value2"]);
    });

    test('should succeed with a pattern that combines element and segment matchers', () => {
        const matcher = match_choose([
            match_constant("a"),
            match_array([match_element("x"), match_segment("segment")])
        ]);

        const data = [["value", "value1", "value2"]];
        const dictionary = new MatchDict(new Map<string, any>());
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
        expect(succeed.mock.calls[0][0].get("x")).toEqual("value");
        expect(succeed.mock.calls[0][0].get("segment")).toEqual(["value1", "value2"]);
    });
});


describe('match_reference', () => {
    test('should resolve and match reference correctly', () => {
        const dictionary = new MatchDict(new Map<string, any>([
            ["ref", match_constant("value")]
        ]));
        const matcher = match_reference("ref");

        const data = ["value"];
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
    });

    test('should fail when reference is not found', () => {
        const dictionary = new MatchDict(new Map<string, any>());
        const matcher = match_reference("ref");

        const data = ["value"];
        const succeed = jest.fn();

        const result = matcher(data, dictionary, succeed);

        expect(succeed).not.toHaveBeenCalled();
        expect(result).toEqual(createMatchFailure(FailedMatcher.Reference, FailedReason.ReferenceNotFound, data, 0, null));
    });
});

describe('match_letrec', () => {
    test('should handle simple recursive patterns correctly', () => {
        const matcher = match_letrec({
            "a": match_constant("1")
        }, match_reference("a"));

        const data = ["1"];
        const dictionary = emptyMatchDict();
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
    });

    test('should fail when simple recursive patterns do not match', () => {
        const matcher = match_letrec({
            "a": match_constant("1")
        }, match_reference("a"));

        const data = ["2"];
        const dictionary = emptyMatchDict();
        const succeed = jest.fn();

        const result = matcher(data, dictionary, succeed);

        expect(succeed).not.toHaveBeenCalled();
        expect(isMatchFailure(result)).toBe(true);
    });
});

describe('match_letrec with tail recursion', () => {
    test('should handle tail recursive patterns correctly', () => {
        const matcher = match_letrec({
            "a": match_choose([match_array([]), match_array([match_constant("1"), match_reference("b")])]),
            "b": match_choose([match_array([]), match_array([match_constant("2"), match_reference("a")])])
        }, match_reference("a"));

        const data = [["1", ["2", ["1", ["2", []]]]]];
        const dictionary = emptyMatchDict();
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result = matcher(data, dictionary, succeed);

        expect(succeed).toHaveBeenCalledWith(expect.any(MatchDict), 1);
        expect(result).toEqual(succeed.mock.results[0].value);
    });

    test('should fail when tail recursive patterns do not match', () => {
        const matcher = match_letrec({
            "a": match_choose([match_array([]), match_array([match_constant("1"), match_reference("b")])]),
            "b": match_choose([match_array([]), match_array([match_constant("2"), match_reference("a")])])
        }, match_reference("a"));

        const data = ["1", ["2", ["1", ["3", []]]]]; // "3" should be "2"
        const dictionary = emptyMatchDict();
        const succeed = jest.fn((dict, nEaten) => ({ dict, nEaten }));

        const result = matcher(data, dictionary, succeed);
        // console.log("result", result)
        // expect(succeed).not.toHaveBeenCalled();
        expect(isMatchFailure(result)).toBe(true);
    });
});


describe("match_builder", () => {
    test("should match letrec pattern correctly", () => {
        const match_builder_test = match_builder(["m:letrec",
                                                 [["a", [match_constant("b"), match_segment("segment")]]], 
                                                 ["d", match_reference("a")]]);

        const result = run_matcher(match_builder_test, ["d", ["b", "c", "e"]], (dict, nEaten) => {
            return { dict, nEaten };
        });

        console.log(result);

        // Add assertions to verify the result
        expect(result).toBeDefined();
        expect(result).toHaveProperty("dict");
        expect(result).toHaveProperty("nEaten");
        expect(result.dict).toBeInstanceOf(MatchDict);
        expect(result.nEaten).toBe(1);
    });


    test("should match m:choose pattern correctly", () => {
        const match_builder_test = match_builder(["m:choose", ["a"], ["b"]]);

        const result = run_matcher(match_builder_test, ["a"], (dict, nEaten) => {
            return { dict, nEaten };
        });

        
        console.log("result", result);

        // Add assertions to verify the result
        expect(result).toBeDefined();
        expect(result).toHaveProperty("dict");
        expect(result).toHaveProperty("nEaten");
        expect(result.dict).toBeInstanceOf(MatchDict);
        expect(result.nEaten).toBe(1);
    });
});
