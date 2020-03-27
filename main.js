const lineTypes = {
    HEADLINE: 'headline',
    TEXT: 'text',
    CODE: 'code',
    LIST: 'list',
};

function headline(level, content){
    const type = lineTypes.HEADLINE;
    return {
        getType: () => type,

        getText: () => `\n${content}\n`,
        getHTML: () => `<h${level}>${content}<\h${level}>`
    }
}

function text(content){
    const type = lineTypes.TEXT;
    return {
        getType: () => type,

        getText: () => `${content}`,
        getHTML: () => `<p>${content}<\p>`,
        toHeadline: (level) => headline(level,content),
    }
}

const parsingStates = {
    NONE: 'none',
    PREVIOUS_TEXT: 'previous_text',
};

const add_to_state = {
    'headline':'none',
    'text':'previous_text'
};


function identified_lines() {
    let identified_array = [];
    let state = parsingStates.NONE;

    function addLine(line) {
        state = add_to_state[line.getType()];
        identified_array.push(line)
    }

    function convertPreviousTextIntoHeadline(headline_level) {
        const lastIndex = identified_array.length - 1;
        const oldText =  identified_array[lastIndex];
        identified_array[lastIndex] = oldText.toHeadline(headline_level);

        state = parsingStates.NONE;
    }

    return {
        getCurrentState: () => state,
        addLine,
        convertPreviousTextIntoHeadline,

        getText: () => identified_array.map((line)=> line.getText()),
        getHTML: () => identified_array.map((line)=> line.getHTML()),
    }
}

function identify_lines(current_identified, line) {
    const state = current_identified.getCurrentState();

    function identifyStandard() {
        const isHeadline = /^ {0,3}(#{1,6})( *(.*))?$/.exec(line);
        if (isHeadline){
            const headline_level = isHeadline[1].length;
            const headline_content = isHeadline[2];
            const new_headline = headline(headline_level,headline_content);
            current_identified.addLine(new_headline);

            return;
        }

        // Text
        current_identified.addLine(text(line));
    }

    switch(state){
        // Standard parsing
        case parsingStates.NONE:

            identifyStandard();

            break;

        case parsingStates.PREVIOUS_TEXT:

            // Special Headlines
            const isSpecialHeadline1 = /^ {0,3}=*$/.test(line);
            if (isSpecialHeadline1){
                current_identified.convertPreviousTextIntoHeadline(1);
                break;
            }

            const isSpecialHeadline2 = /^ {0,3}-*$/.exec(line);
            if (isSpecialHeadline2){
                current_identified.convertPreviousTextIntoHeadline(2);
                break;
            }

            identifyStandard();
    }
    return current_identified;
}

const input =
`# Hola1
Hola1
=====
## Hola2
Hola2
-----
Hola0
### Hola3
#### Hola4
##### Hola5
###### Hola6`;


const step1 = input.split('\n');
const step2 = step1.reduce(identify_lines, identified_lines());
console.log(step2.getText());
console.log(step2.getHTML());