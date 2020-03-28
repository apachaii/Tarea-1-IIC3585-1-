const _ = require('lodash');

function headline(level, content){
    return {
        getText: () => `${content}\n`,
        getHTML: () => `<h${level}>${content}<\h${level}>`
    }
}

function text(content){
    return {
        getText: () => `${content}`,
        getHTML: () => `<p>${content}<\p>`,
        toHeadline: (level) => headline(level,content),
    }
}

function code(){
    let lines = [];

    function getText() {
        const textLines = lines.map(line=>`    ${line}`);
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
        getHTML: () => `<code>${lines.join('\n')}<\code>`,
    }
}

function listElement() {
    const lines = [];
    let identified = null;

    function identify() {
        identified = lines.reduce(identify_lines, identified_lines());
    }

    function getText() {
        const identifiedTexts = identified ? identified.getText() : [''];

        const flattenedIdentifiedTexts = _.flattenDeep(identifiedTexts);
        return flattenedIdentifiedTexts.map(
            (textLine, index) => {
                if (index === 0)
                    return `    * ${textLine}`;
                return `      ${textLine}`;
            }
        );
    }

    return {
        addLine: (line) => lines.push(line),
        identify,

        getText,
        getHTML: () => identified ? identified.getHTML() : '',
    }
}

function list(numbered) {
    const elements = [];

    function addLine(line) {
        const lastIndex = elements.length - 1;
        const elementHead = elements[lastIndex];

        elementHead.addLine(line);
    }

    function identifyList() {
        elements.forEach((element)=>element.identify())
    }

    function getText(){
        const elementsText = elements.map(element => element.getText());
        return _.flattenDeep(elementsText);
    }

    return {
        addElement: () => elements.push(listElement()),
        addLine,
        identifyList,

        getText,
        getHTML: () => elements.map(element => element.getHTML()),
    }
}

const parsingStates = {
    STANDARD: 'standard',
    AFTER_TEXT: 'after_text',
    CODE_MARK: 'code_mark',
    CODE_SPACES: 'code_spaces',
    UNORDERED_LIST: 'unordered_list',
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
    function addHeadline(headline_level,headline_content) {
        const new_headline = headline(headline_level,headline_content);
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

    // TODO add remove the empty lines from the end of the code loadash dropRightWhile
    function endCodeFromSpaces(){
        const finishedCode = getHead();
        finishedCode.removeEmptyLinesAtTheEnd();

        state = parsingStates.STANDARD;
    }

    function addLineToCode(line) {
        const activeCode = getHead();
        activeCode.addLine(line);
    }

    // List
    function startUnorderedList(symbol, content) {
        currentListSymbol = symbol;

        const newList= list(false);
        newList.addElement();
        if (content && content.length){
            newList.addLine(content)
        }

        identified_array.push(newList);
        state = parsingStates.UNORDERED_LIST;
    }

    function endUnorderedList() {
        state = parsingStates.STANDARD;
        currentListSymbol = null;

        const currentList = getHead();
        currentList.identifyList();
    }
    
    function addElementToList(content) {
        const currentList = getHead();
        currentList.addElement();
        if (content && content.length){
            currentList.addLine(content)
        }
    }

    function addLineToList(line) {
        const currentList = getHead();
        if (line && line.length){
            currentList.addLine(line)
        }
    }

    return {
        getCurrentState: () => state,
        getCurrentListSymbol: () => currentListSymbol,
        getBlankCount: () => blankCount,
        increaseBlankCount: () => blankCount++,
        resetBlankCount: () => blankCount=0,

        addHeadline,

        addText,
        convertPreviousTextIntoHeadline,

        startCodeFromMark,
        endCodeFromMark,
        startCodeFromSpaces,
        endCodeFromSpaces,
        addLineToCode,

        startUnorderedList,
        endUnorderedList,
        addElementToList,
        addLineToList,


        setStandardState: () => state = parsingStates.STANDARD,

        getText: () => identified_array.map((line)=> line.getText()),
        getHTML: () => identified_array.map((line)=> line.getHTML()),
    }
}

function identify_lines(current_identified, line, currentIndex, lines_array) {
    const identify_until = functions => {
        return functions.reduce(
            (do_continue, func) => {
                if (do_continue){
                    return !func(line);
                }
                return false;
            },
            true,
        );
    };


    const identify_state = current_identified.getCurrentState();
    const identify_list_symbol = current_identified.getCurrentListSymbol();

    function identifyEmptyStandard() {
        const isEmpty = /^\s*$/.test(line);
        if(isEmpty){
            current_identified.setStandardState();
        }
        return isEmpty;
    }

    function identifyHeadline() {
        const isHeadline = /^ {0,3}(#{1,6})( *(.*))?$/.exec(line);
        if (isHeadline){
            const headline_level = isHeadline[1].length;
            const headline_content = isHeadline[3];
            current_identified.addHeadline(headline_level,headline_content);
        }
        return isHeadline;
    }

    function identifyCodeMark() {
        const isCodeMark = /^`{3}.+$/.test(line);
        if (isCodeMark){
            current_identified.startCodeFromMark();
        }
        return isCodeMark;
    }

    function  identifyCodeSpaces() {
        const isCodeSpaces = /^ {4}.+$/.test(line);
        if (isCodeSpaces){
            const usedLine = line.substr(4);
            current_identified.startCodeFromSpaces(usedLine);
        }
        return isCodeSpaces;
    }

    function  identifyUnorderedList() {
        const isUnordered = /^ {0,3}([-+*])( (.*))?$/.exec(line);
        if (isUnordered){
            const symbol = isUnordered[1];
            const content = isUnordered[3];
            current_identified.startUnorderedList(symbol, content);
        }
        return isUnordered;
    }

    function defaultIdentifyText() {
        current_identified.addText(line);
    }

    const defaultIdentify = [
        identifyHeadline,
        identifyCodeMark,
        identifyCodeSpaces,
        identifyUnorderedList,
        defaultIdentifyText,
    ];

    switch(identify_state){
        
        case parsingStates.STANDARD: {

            identify_until(
                [
                    identifyEmptyStandard,
                    ...defaultIdentify,
                ],
            );

            break;
        }

        case parsingStates.AFTER_TEXT: {

            function identifySpecialHeadline1() {
                const isSpecialHeadline1 = /^ {0,3}=*$/.test(line);
                if (isSpecialHeadline1) {
                    current_identified.convertPreviousTextIntoHeadline(1);
                }
                return isSpecialHeadline1;
            }

            function identifySpecialHeadline2() {
                const isSpecialHeadline2 = /^ {0,3}-*$/.test(line);
                if (isSpecialHeadline2) {
                    current_identified.convertPreviousTextIntoHeadline(2);
                }
                return isSpecialHeadline2;
            }

            identify_until(
                [
                    identifySpecialHeadline1,
                    identifySpecialHeadline2,
                    identifyEmptyStandard,
                    ...defaultIdentify,
                ],
            );
            break;
        }

        case parsingStates.CODE_MARK:{
            function identifyCodeMarkEnd() {
                const isMarkEnd = /^`{3}$/.test(line);
                if (isMarkEnd){
                    current_identified.endCodeFromMark();
                }
                return isMarkEnd;
            }

            identify_until(
                [
                    identifyCodeMarkEnd,
                    () => current_identified.addLineToCode(line),
                ]
            );

            break;
        }

        case parsingStates.CODE_SPACES:{

            function codeSpacesLastLineProcess () {
                const isLastLine = currentIndex === lines_array.length-1;
                if (isLastLine){
                    current_identified.endCodeFromSpaces();
                }
            }

            function identifyCodeLineFromSpaces() {
                const isACodeLine =  /^ {4}.+$/.test(line);
                if (isACodeLine){
                    const usedLine = line.substr(4);
                    current_identified.addLineToCode(usedLine);

                    codeSpacesLastLineProcess();
                }
                return isACodeLine;
            }

            function identifyCustomEmptyLineFromSpaces() {
                const isEmpty = /^\s*$/.test(line);
                if (isEmpty){
                    codeSpacesLastLineProcess();
                }
                return isEmpty;
            }

            function finishCodeSpaces() {
                current_identified.endCodeFromSpaces();
                return false;
            }

            identify_until(
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

            function unorderedListLastLineProcess() {
                const isLastLine = currentIndex === lines_array.length-1;
                if (isLastLine){
                    current_identified.endUnorderedList();
                }
            }

            function identifyNewListLine() {
                const isNewElement = /^ {2}(.*)$/.exec(line);
                if (isNewElement){
                    const content = isNewElement[1];
                    current_identified.addLineToList(content);

                    unorderedListLastLineProcess();
                }
                return isNewElement;
            }

            function identifyNewListElement() {
                const isListElement = /^ {0,3}([-+*])( (.*))?$/.exec(line);
                if (isListElement && isListElement[1] === identify_list_symbol){
                    const content = isListElement[3];
                    current_identified.addElementToList(content);

                    unorderedListLastLineProcess();
                }
                return isListElement;
            }

            function identifyCustomEmptyLineFromUnorderedLine() {
                const is_empty = /^\s*$/.test(line);
                if (is_empty){
                    current_identified.increaseBlankCount();
                    unorderedListLastLineProcess();
                }
                if (current_identified.getBlankCount() > 2){
                    current_identified.resetBlankCount();
                    return false
                }
                return is_empty;
            }

            function finishUnorderedList() {
                current_identified.endUnorderedList();
                return false;
            }

            identify_until(
                [
                    identifyNewListLine,
                    identifyNewListElement,
                    identifyCustomEmptyLineFromUnorderedLine,
                    finishUnorderedList,
                    ...defaultIdentify,
                ],
            );

            break;
        }
    }
    return current_identified;
}

const input = `- hola1
  - hola2
    hola2.1
    hola2.2
    hola2.3
  - hola2.4
    hola2.5
    hola2.6
    hola2.7
    hola2.8
- hola3
  
- hola4
  hola5

- # hola6
        hola
         que
          tal

            hola
             que
              tal`;

const step1 = input.split('\n');
const step2 = step1.reduce(identify_lines, identified_lines());

const textLines = step2.getText();
const separatedLines = _.flatten(textLines);

console.log(separatedLines.join('\n'));
console.log(1);