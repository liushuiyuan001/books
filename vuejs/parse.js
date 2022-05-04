const State = {
    initial: 1, // 初始状态
    tagOpen: 2, // 标签开始状态
    tagName: 3, // 标签名称状态
    text: 4, // 文本状态
    tagEnd: 5, // 结束标签状态
    tagEndName: 6, // 结束标签名称状态
}

function isAlpha(char) {
    return /^[a-zA-Z]$/.test(char)
}

function tokenzie(str) {
    // 当前状态
    let currentState = State.initial
    // 缓存字符
    const chars = []
    // 生成的token
    const tokens = []

    while(str) {
        const char = str[0]
        switch(currentState) {
            case State.initial:
                if(char === '<') {
                    currentState = State.tagOpen
                    str = str.slice(1)
                } else if(isAlpha(char)) {
                    currentState = State.text
                    chars.push(char)
                    str = str.slice(1)
                }
                break;
            case State.tagOpen:
                if(isAlpha(char)) {
                    currentState = State.tagName
                    chars.push(char)
                    str = str.slice(1)
                } else if(char === '/') {
                    currentState = State.tagEnd
                    str = str.slice(1)
                }
                break;
            case State.tagName:
                if(isAlpha(char)) {
                    chars.push(char)
                    str = str.slice(1)
                } else if(char === ">") {
                    currentState = State.initial
                    tokens.push({
                        type: 'tag',
                        name: chars.join('')
                    })

                    chars.length = 0
                    str = str.slice(1)
                }
                break;
            case State.text:
                if(isAlpha(char)) {
                    chars.push(char)
                    str = str.slice(1)
                } else if(char === '<') {
                    currentState = State.tagOpen
                    tokens.push({
                        type: 'text',
                        content: chars.join('')
                    })
                    chars.length = 0
                    str = str.slice(1)
                }
                break;
            case State.tagEnd:
                if(isAlpha(char)) {
                    currentState = State.tagEndName
                    chars.push(char)
                    str = str.slice(1)
                }
                break;
            case State.tagEndName:
                if(isAlpha(char)) {
                    chars.push(char)
                    str = str.slice(1)
                } else if(char === '>') {
                    currentState = State.initial

                    tokens.push({
                        type: 'tagEnd',
                        name: chars.join('')
                    })

                    chars.length = 0
                    str = str.slice(1)
                }
                break;
        }

    }

    return tokens
}


function parse(str) {
    const tokens = tokenzie(str)
    // 创建root根节点
    const root = {
        type: 'root',
        children: []
    }

    const elementStack = [root]

    while(tokens.length) {
        // 获取父节点
        const parent = elementStack[elementStack.length - 1]
        // console.log(parent)
        const t = tokens[0]
        switch(t.type) {
            case 'tag':
                const elementNode = {
                    type: 'Element',
                    tag: t.name,
                    children: []
                }
                // 将当前节点添加到父节点中
                parent.children.push(elementNode)
                // 将当前节点入栈
                elementStack.push(elementNode)
                break;
            case 'text':
                const textNode = {
                    type: 'Text',
                    content: t.content
                }
                // 将当前节点添加到父节点中
                parent.children.push(textNode)
                break;
            case 'tagEnd':
                // 如果结束标签，当前栈出栈
                elementStack.pop()
                break;
        }
        // tokens出队列
        tokens.shift()
    }
    return root
}

console.log(JSON.stringify(parse('<p>Vue</p>')))