const TextModes = {
    DATA: 'DATA',
    RCDATA: 'RCDATA',
    RAWTEXT: 'RAWTEXT',
    CDATA: 'CDATA'
}

function parse(str) {
    // 定义上下文对象
    const context = {
        source: str,
        mode: TextModes.DATA,
        advanceBy(num) {
            context.source = context.source.slice(num)
        },
        // 无论是开始标签还是结束标签，都可能存在无用的空白字符，例如 <div  >
        advanceSpaces() {
            // 匹配空白字符
            const match = /^[\t\r\n\f]+/.exec(context.source)
            if (match) {
                context.advanceBy(match[0].length)
            }
        }
    }
    // 第二个参数为父节点构成的节点栈
    const nodes = parseChildren(context,[])
    
    return {
        type: 'Root',
        children: nodes
    }
}

function parseChildren(context, ancestors) {
    // 定义 nodes 数组存储子节点，作为最终的返回值
    let nodes = []
    // 从上下文对象中取得当前状态，包括模式mode和模板内容source
    const { mode, source } = context
    // 关于
    while (!isEnd(context, ancestors)) {
        let node
        //   
        if(mode === TextModes.DATA || mode === TextModes.RCDATA) {
            if(mode === TextModes.DATA && source[0] === '<') {
                if(source[1] === '!') {
                    if(source.startsWith('<!--')) {
                        // 注释
                        node = parseComment(context)
                    } else if(source.startsWith('<![CDATA[')) {
                        // CDATA
                        node = parseCDATA(context, ancestors)
                    }
                } else if(source[1] === '/') {
                    // 结束标签，这里需要抛出错误，后文会详细解释原因
                    // 状态机遭遇了闭合标签，此时应该抛出错误，因为它缺少与之对应的开始标签
                    console.error('无效的结束标签')
                    continue
                } else if(/[a-z]/i.test(source[1])) {
                    // 标签
                    node = parseElement(context)
                }
            } else if(source.startsWith('{{')) {
                node = parseInterpolation(context)
            }
        }

        // node 不存在，说明处于其他模式 即非 DATA 模式且非 RCDATA 模式
        // 这时一切内容都作为文本处理
        if(!node) {
            // 解析文本节点
            node = parseText(context)
        }

        nodes.push(node)
    }

    return nodes
}

function isEnd(context, ancestors) {
    if(!context.source) return true
    // 获取父级标签节点
    for(let i = ancestors.length - 1; i >= 0; i--) {
        if(parent && context.source.startsWith(`</${ancestors[i].tag}`)) {
            return true
        }
    }
    
    return false
}

function parseComment(context) {

}

function parseCDATA(context, ancestors) {

}

function parseTag(context, type = 'start') {
    // 从上下文对象中拿到advanceBy函数
    const { advanceBy, advanceSpaces } = context

    // 处理开始标签和结束标签的正则表达式不同
    const match = type === 'start' ? /^<([a-z][^\t\r\n\f />]*)/i.exec(context.source)
    : /^<\/([a-z][^\t\r\n\f />]*)/.exec(context.source)
    const tag = match[1]
    advanceBy(match[0].length)
    // 消费标签中无用的空白字符
    advanceSpaces()
    // 在消费匹配的内容后，如果字符串以 '/>' 开头, 则说明这是一个自闭合标签
    const isSelfClosing = context.source.startsWith('/>')
    // 如果是自闭合标签，则消费 '/>' 否则消费 '>'
    advanceBy(isSelfClosing ? 2 : 1)

    return {
        type: 'Element',
        tag,
        props: [],
        children: [],
        isSelfClosing
    }

}

function parseElement(context, ancestors) {
    // 解析开始标签
    const element = parseTag(context)
    if(element.isSelfClosing) return element

    ancestors.push(element)
    // 这里递归调用 parseChildren 函数进行 <div> 标签子节点的解析
    element.children = parseChildren()
    ancestors.pop()

    if(context.source.startsWith(`</${element.tag}`)) {
        parseTag(context, 'end')
    } else {
        // 缺少闭合标签
        console.log(`${element.tag} 标签缺少闭合标签`)
    }

    return element
}

function parseInterpolation(context, ancestors) {

}

function parseText(context, ancestors) {

}