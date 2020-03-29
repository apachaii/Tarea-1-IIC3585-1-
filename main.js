const _ = require('lodash');

function headline(level, content) {
    return {
        getText: () => `${content}\n`,
        getHtml: () => `<h${level}>${content}<\h${level}>`
    }
}

function text(content) {
    return {
        toHeadline: (level) => headline(level, content),

        getText: () => `${content}`,
        getHtml: (onlyText) => {
            if (onlyText) {
                return content;
            }
            if (content === "") {
                return "<br>"
            }
            return `<p>${content}<\p>`
        },
    }
}

function code() {
    let lines = [];

    function getText() {
        const textLines = lines.map(line => `    ${line}`);
        textLines.unshift('\n');
        textLines.push('\n');
        return textLines;
    }

    function removeEmptyLinesAtTheEnd() {
        lines = _.dropRightWhile(lines, (line) => /^\s*$/.test(line));
    }

    return {
        addLine: (line) => lines.push(line),
        removeEmptyLinesAtTheEnd,

        getText,
        getHtml: () => `<code>${lines.join('\n')}<\code>`,
    }
}

function listElement() {
    const lines = [];
    let identified = null;

    function identify() {
        identified = lines.reduce(identify_lines(), identified_lines());
    }

    function getText(symbol) {
        const identifiedTexts = identified.getText();

        if (identifiedTexts.length === 0) {
            return [`    ${symbol}`];
        }

        const flattenedIdentifiedTexts = _.flattenDeep(identifiedTexts);
        const align = ' '.repeat(symbol.length);

        return flattenedIdentifiedTexts.map(
            (textLine, index) => {
                if (index === 0)
                    return `    ${symbol} ${textLine}`;
                return `    ${align} ${textLine}`;
            }
        );
    }

    const onlyText = true;

    function getHtml() {
        const identifiedTexts = identified.getHtml(onlyText);
        const flattenedIdentifiedTexts = _.flattenDeep(identifiedTexts);
        const spacedList = flattenedIdentifiedTexts.map(text => `  ${text}`);

        if (spacedList.length === 0) {
            return '<li/>';
        }

        spacedList.unshift('<li>');
        spacedList.push('</li>');

        return spacedList;
    }

    return {
        addLine: (line) => lines.push(line),
        identify,

        getText,
        getHtml,
    }
}

function list(numbered, startingNumber = 0) {
    const elements = [];

    function addLine(line) {
        const lastIndex = elements.length - 1;
        const elementHead = elements[lastIndex];

        elementHead.addLine(line);
    }

    function identifyList() {
        elements.forEach((element) => element.identify())
    }

    function getText() {
        const elementsText = elements.map(
            (element, index) => {
                return element.getText(
                    numbered ? ` ${startingNumber + index}.` : '*'
                )
            });
        return _.flattenDeep(elementsText);
    }

    function getHtml() {
        const elementsHtml = elements.map(
            (element) => element.getHtml()
        );
        const elementsFlattened = _.flattenDeep(elementsHtml);
        const elementsSpaced = elementsFlattened.map((element) => `  ${element}`);
        elementsSpaced.unshift(
            numbered
                ? `<ol start="${startingNumber}">`
                : '<ul>'
        );
        elementsSpaced.push(
            numbered
                ? '</ol>'
                : '</ul>'
        );
        return elementsSpaced;
    }

    return {
        addElement: () => elements.push(listElement()),
        addLine,
        identifyList,

        getText,
        getHtml,
    }
}

const parsingStates = {
    STANDARD: 'standard',
    AFTER_TEXT: 'after_text',
    CODE_MARK: 'code_mark',
    CODE_SPACES: 'code_spaces',
    UNORDERED_LIST: 'unordered_list',
    ORDERED_LIST: 'ordered_list',
};

function identified_lines() {
    let identified_array = [];
    let state = parsingStates.STANDARD;
    let currentListSymbol = null;
    let blankCount = 0;

    function getHead() {
        const lastIndex = identified_array.length - 1;
        return identified_array[lastIndex];
    }

    // Headline
    function addHeadline(headline_level, headline_content) {
        const new_headline = headline(headline_level, headline_content);
        identified_array.push(new_headline);
        state = parsingStates.STANDARD;
    }

    // Text
    function addText(line) {
        const newText = text(line);
        identified_array.push(newText);
        state = parsingStates.AFTER_TEXT;
    }

    function convertPreviousTextIntoHeadline(headline_level) {
        const oldText = getHead();
        const lastIndex = identified_array.length - 1;
        identified_array[lastIndex] = oldText.toHeadline(headline_level);

        state = parsingStates.STANDARD;
    }

    // Code
    function addCode() {
        const newCode = code();
        identified_array.push(newCode);
    }

    function startCodeFromMark() {
        addCode();
        state = parsingStates.CODE_MARK;
    }

    function endCodeFromMark() {
        state = parsingStates.STANDARD;
    }

    function startCodeFromSpaces(line) {
        addCode();
        state = parsingStates.CODE_SPACES;
        addLineToCode(line);
    }

    function endCodeFromSpaces() {
        const finishedCode = getHead();
        finishedCode.removeEmptyLinesAtTheEnd();

        state = parsingStates.STANDARD;
    }

    function addLineToCode(line) {
        const activeCode = getHead();
        activeCode.addLine(line);
    }

    // List
    function startUnorderedList(symbol, content, isLastLine) {
        currentListSymbol = symbol;
        const newList = list(false);
        newList.addElement();
        if (content && content.length) {
            newList.addLine(content)
        }

        identified_array.push(newList);
        state = parsingStates.UNORDERED_LIST;

        if (isLastLine) {
            endList();
        }
    }

    function startOrderedList(number, content, isLastLine) {

        const newList = list(true, parseInt(number));
        newList.addElement();
        if (content && content.length) {
            newList.addLine(content)
        }

        identified_array.push(newList);
        state = parsingStates.ORDERED_LIST;

        if (isLastLine) {
            endList();
        }
    }

    function endList() {
        state = parsingStates.STANDARD;
        currentListSymbol = null;

        const currentList = getHead();
        currentList.identifyList();
    }

    function addElementToList(content) {
        const currentList = getHead();
        currentList.addElement();
        if (content && content.length) {
            currentList.addLine(content)
        }
    }

    function addLineToList(line) {
        const currentList = getHead();
        if (line && line.length) {
            currentList.addLine(line)
        }
    }

    return {
        getCurrentState: () => state,
        getCurrentListSymbol: () => currentListSymbol,
        getBlankCount: () => blankCount,
        increaseBlankCount: () => blankCount++,
        resetBlankCount: () => blankCount = 0,

        addHeadline,

        addText,
        convertPreviousTextIntoHeadline,

        startCodeFromMark,
        endCodeFromMark,
        startCodeFromSpaces,
        endCodeFromSpaces,
        addLineToCode,

        startUnorderedList,
        startOrderedList,
        endList,

        addElementToList,
        addLineToList,


        setStandardState: () => state = parsingStates.STANDARD,

        getText: () => identified_array.map((line) => line.getText()),
        getHtml: (onlyText = false) => {

            // if there is only one text element and is text, return only text
            if (onlyText && identified_array.length === 1) {
                const textFound = identified_array[0].getHtml(true);
                if (textFound.length === 0) {
                    return [];
                }
                return [textFound];
            }

            return identified_array.map((line) => line.getHtml());
        }
    }
}

function identify_lines() {
    const identify_until = (line, current_identified, currentIndex, lines_array, functions) => {
        return functions.reduce(
            (do_continue, func) => {
                if (do_continue) {
                    return !func(line, current_identified, currentIndex, lines_array);
                }
                return false;
            },
            true,
        );
    };

    function basicPatterIdentify(regex, effect) {
        return function (line, current_identified, currentIndex, lines_array) {
            const test_successful = regex.exec(line);
            if (test_successful) {
                effect(test_successful, current_identified, currentIndex, lines_array);
            }
            return test_successful;
        }

    }

    function isLast(currentIndex, lines_array) {
        return currentIndex === lines_array.length - 1;
    }

    // Default process
    const identifyEmptyStandard = basicPatterIdentify(
        /^\s*$/,
        (_, current_identified) => current_identified.setStandardState()
    );

    const identifyHeadline = basicPatterIdentify(
        /^ {0,3}(#{1,6})( *(.*))?$/,
        (isHeadline, current_identified) => {
            const headline_level = isHeadline[1].length;
            const headline_content = isHeadline[3];
            current_identified.addHeadline(headline_level, headline_content);
        },
    );

    const identifyCodeMark = basicPatterIdentify(
        /^`{3}.*$/,
        (_, current_identified) => current_identified.startCodeFromMark(),
    );

    const identifyCodeSpaces = basicPatterIdentify(
        /^ {4}.+$/,
        (isCodeSpaces, current_identified,) => {
            const usedLine = isCodeSpaces[0].substr(4);
            current_identified.startCodeFromSpaces(usedLine);
        },
    );

    const identifyUnorderedList = basicPatterIdentify(
        /^ {0,3}([-+*])( (.*))?$/,
        (isUnordered, current_identified, currentIndex, lines_array) => {
            const symbol = isUnordered[1];
            const content = isUnordered[3];
            const isLastLine = isLast(currentIndex, lines_array);
            current_identified.startUnorderedList(symbol, content, isLastLine);
        },
    );

    const identifyOrderedList = basicPatterIdentify(
        /^ {0,3}(0|[1-9][0-9]*)\.( (.*))?$/,
        (isUnordered, current_identified, currentIndex, lines_array) => {
            const number = isUnordered[1];
            const content = isUnordered[3];
            const isLastLine = isLast(currentIndex, lines_array);
            current_identified.startOrderedList(number, content, isLastLine);
        },
    );

    function defaultIdentifyText(line, current_identified) {
        current_identified.addText(line);
    }

    const defaultIdentify = [
        identifyHeadline,
        identifyCodeMark,
        identifyCodeSpaces,
        identifyUnorderedList,
        identifyOrderedList,
        defaultIdentifyText,
    ];

    // After Text

    const identifySpecialHeadline1 = basicPatterIdentify(
        /^ {0,3}=+\s*$/,
        (line, current_identified) => current_identified.convertPreviousTextIntoHeadline(1)
    );

    const identifySpecialHeadline2 = basicPatterIdentify(
        /^ {0,3}-+\s*$/,
        (_, current_identified) => current_identified.convertPreviousTextIntoHeadline(2)
    );

    // Code Mark

    const identifyCodeMarkEnd = basicPatterIdentify(
        /^`{3}$/,
        (_, current_identified) => current_identified.endCodeFromMark(),
    );

    const addLineToCode = (line, current_identified) => current_identified.addLineToCode(line);


    // Code Spaces

    const codeSpacesLastLineProcess = (_, current_identified, currentIndex, lines_array) => {
        const isLastLine = isLast(currentIndex, lines_array);
        if (isLastLine) {
            current_identified.endCodeFromSpaces();
        }
    };

    const identifyCodeLineFromSpaces = basicPatterIdentify(
        /^ {4}(.+)$/,
        (line, current_identified, currentIndex, lines_array) => {
            const usedLine = line[1];
            current_identified.addLineToCode(usedLine);

            codeSpacesLastLineProcess(_, current_identified, currentIndex, lines_array);
        }
    );

    const identifyCustomEmptyLineFromSpaces = basicPatterIdentify(
        /^\s*$/,
        (_, current_identified, currentIndex, lines_array) =>
            codeSpacesLastLineProcess(_, current_identified, currentIndex, lines_array)
    );

    const finishCodeSpaces = (_, current_identified) => {
        current_identified.endCodeFromSpaces();
        return false;
    };

    // Unordered List

    const listLastLineProcess = (_, current_identified, currentIndex, lines_array) => {
        const isLastLine = isLast(currentIndex, lines_array);
        if (isLastLine) {
            current_identified.endList();
        }
    };

    const identifyNewListLine = basicPatterIdentify(
        /^ {2}(.*)$/,
        (isNewElement, current_identified, currentIndex, lines_array) => {
            const content = isNewElement[1];
            current_identified.addLineToList(content);

            listLastLineProcess(_, current_identified, currentIndex, lines_array);
        }
    );

    const identifyNewListElement = (line, current_identified, currentIndex, lines_array, identify_list_symbol) => {
        const isListElement = /^ {0,3}([-+*])( (.*))?$/.exec(line);
        if (isListElement && isListElement[1] === identify_list_symbol) {
            const content = isListElement[3];
            current_identified.addElementToList(content);

            listLastLineProcess(_, current_identified, currentIndex, lines_array);
        }
        return isListElement;
    };

    function identifyCustomEmptyLineFromList(line, current_identified, currentIndex, lines_array) {
        const is_empty = /^\s*$/.test(line);
        if (is_empty) {
            current_identified.increaseBlankCount(_, current_identified, currentIndex, lines_array);
            listLastLineProcess(_, current_identified, currentIndex, lines_array);
        }
        if (current_identified.getBlankCount() > 2) {
            current_identified.resetBlankCount();
            return false
        }
        return is_empty;
    }

    function finishUnorderedList(_, current_identified) {
        current_identified.endList();
        return false;
    }

    // Ordered List

    const identifyNewOrderedListElement = basicPatterIdentify(
        /^ {0,3}(0|[1-9][0-9]*)\.( (.*))?$/,
        (isOrderedListElement, current_identified, currentIndex, lines_array) => {
            const content = isOrderedListElement[3];
            current_identified.addElementToList(content);

            listLastLineProcess(_, current_identified, currentIndex, lines_array);
        }
    );

    return (current_identified, line, currentIndex, lines_array) => {
        const identify_state = current_identified.getCurrentState();

        switch (identify_state) {

            case parsingStates.STANDARD: {
                identify_until(
                    line,
                    current_identified,
                    currentIndex,
                    lines_array,
                    [
                        identifyEmptyStandard,
                        ...defaultIdentify,
                    ],
                );

                break;

            }

            case parsingStates.AFTER_TEXT: {

                identify_until(
                    line,
                    current_identified,
                    currentIndex,
                    lines_array,
                    [
                        identifySpecialHeadline1,
                        identifySpecialHeadline2,
                        identifyEmptyStandard,
                        ...defaultIdentify,
                    ],
                );

                break;

            }

            case parsingStates.CODE_MARK: {

                identify_until(
                    line,
                    current_identified,
                    currentIndex,
                    lines_array,
                    [
                        identifyCodeMarkEnd,
                        addLineToCode,
                    ]
                );

                break;
            }

            case parsingStates.CODE_SPACES: {

                identify_until(
                    line,
                    current_identified,
                    currentIndex,
                    lines_array,
                    [
                        identifyCodeLineFromSpaces,
                        identifyCustomEmptyLineFromSpaces,
                        finishCodeSpaces,
                        ...defaultIdentify,
                    ],
                );

                break;
            }

            case parsingStates.UNORDERED_LIST: {
                const identify_list_symbol = current_identified.getCurrentListSymbol();

                // K combinator
                const K_identifyNewListElement = (current_identified, line, currentIndex, lines_array) =>
                    identifyNewListElement(current_identified, line, currentIndex, lines_array, identify_list_symbol);

                identify_until(
                    line,
                    current_identified,
                    currentIndex,
                    lines_array,
                    [
                        identifyNewListLine,
                        K_identifyNewListElement,
                        identifyCustomEmptyLineFromList,
                        finishUnorderedList,
                        ...defaultIdentify,
                    ],
                );

                break;
            }

            case parsingStates.ORDERED_LIST: {

                identify_until(
                    line,
                    current_identified,
                    currentIndex,
                    lines_array,
                    [
                        identifyNewListLine,
                        identifyNewOrderedListElement,
                        identifyCustomEmptyLineFromList,
                        finishUnorderedList,
                        ...defaultIdentify,
                    ],
                );

                break;
            }
        }
        return current_identified;
    }
}

const input = `

- hola
  que pasó
  - que
  - cosa
- Buano
  8. n
  2. n
  3. n
-
-
-

hhhh

`;

const step1 = input.split('\n');
const step2 = step1.reduce(identify_lines(), identified_lines());

const textLines = step2.getText();
const separatedLines = _.flatten(textLines);
const WEB = separatedLines.join('\n');

const step3 = input.split('\n');
const step4 = step3.reduce(identify_lines(), identified_lines());

const textLines3 = step4.getHtml();
const separatedLines3 = _.flatten(textLines3);
const WEB2 = separatedLines3.join('\n');

console.log(WEB2);

module.exports = {
    WEB
};