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
            const match = /^[\t\r\n\f ]+/.exec(context.source)
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
                    node = parseElement(context, ancestors)
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
        if(context.source.startsWith(`</${ancestors[i].tag}`)) {
            return true
        }
    }
    
    return false
}

function parseComment(context) {
    context.advanceBy('<!--'.length)
    const closeIndex = context.source.indexOf('-->')
    // 获取注释节点的内容
    const content = context.source.slice(0,closeIndex)
    // 消费内容
    context.advanceBy(content.length)
    context.advanceBy('-->')

    // 返回类型为comment的节点
    return {
        type: 'Comment',
        context
    }
}

function parseCDATA(context, ancestors) {

}

function parseTag(context, type = 'start') {
    // 从上下文对象中拿到advanceBy函数
    const { advanceBy, advanceSpaces } = context

    // 处理开始标签和结束标签的正则表达式不同
    const match = type === 'start' ? /^<([a-z][^\t\r\n\f />]*)/i.exec(context.source)
    : /^<\/([a-z][^\t\r\n\f />]*)/i.exec(context.source)
    const tag = match[1]
    advanceBy(match[0].length)
    // 消费标签中无用的空白字符
    advanceSpaces()

    const props = parseAttributes(context)

    // 在消费匹配的内容后，如果字符串以 '/>' 开头, 则说明这是一个自闭合标签
    const isSelfClosing = context.source.startsWith('/>')
    // 如果是自闭合标签，则消费 '/>' 否则消费 '>'
    advanceBy(isSelfClosing ? 2 : 1)

    return {
        type: 'Element',
        tag,
        props,
        children: [],
        isSelfClosing
    }

}

// const context = {
//     source: `id="attributes" v-show="display" />`,
//     mode: TextModes.DATA,
//     advanceBy(num) {
//         context.source = context.source.slice(num)
//     },
//     // 无论是开始标签还是结束标签，都可能存在无用的空白字符，例如 <div  >
//     advanceSpaces() {
//         // 匹配空白字符
//         const match = /^[\t\r\n\f ]+/.exec(context.source)
//         if (match) {
//             context.advanceBy(match[0].length)
//         }
//     }
// }

// console.log(parseAttributes(context))


function parseAttributes(context) {
    const { advanceBy, advanceSpaces} = context
    const props = []

    while(!context.source.startsWith('>') && !context.source.startsWith('/>')){
        // 该正则用于匹配属性名称
        const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)
        // 得到属性名称
        const name = match[0]
        // 消费属性名称
        advanceBy(name.length)
        // 消费属性名称与等号之间的空白字符
        advanceSpaces()
        // 消费等号
        advanceBy(1)
        // 消费等号与属性值之间的空白字符
        advanceSpaces()

        // 属性值
        let value = ''

        // 获取当前模板内容的第一个字符
        const quote = context.source[0]
        // 判断属性值是否被引号引用
        const isQuoted = quote === '"' || quote === "'"

        if(isQuoted) {
            // 消费引号
            advanceBy(1)
            // 获取下一个引号的索引
            const endQuoteIndex = context.source.indexOf(quote)
            if(endQuoteIndex > -1){
                // 获取下一个引号之前的内容作为属性值
                value = context.source.slice(0, endQuoteIndex)
                // 消费属性值
                advanceBy(value.length)
                // 消费引号
                advanceBy(1)
            } else {
                console.error('缺少引号')
            }

        } else {
            // 属性值没有引号
            const match = /^[^\t\r\n\f >]+/.exec(context.source)
            // 获取属性值
            value = match[0]
            // 消费属性值
            advanceBy(value.length)
        }

        // 消费属性值后面的空白字符
        advanceSpaces()

        // 使用属性名称 + 属性值创建一个属性节点 添加到 props 数组中
        props.push({
            type: 'Attribute',
            name,
            value
        })
    }

    return props
}

function parseElement(context, ancestors) {
    // 解析开始标签
    const element = parseTag(context)
    if(element.isSelfClosing) return element

    // 切换到正确的文本模式
    if(element.tag === 'textarea' || element.tag === 'title'){
        // 如果由 parseTag 解析得到的标签是 <textarea> <title> 则切换到RCDATA模式
        context.mode = TextModes.RCDATA
    } else if(/style|xmp|iframe|noembed|noframes|noscript/.test(element.tag)) {
        context.mode = TextModes.RAWTEXT
    } else {
        context.mode = TextModes.DATA
    }

    ancestors.push(element)
    // 这里递归调用 parseChildren 函数进行 <div> 标签子节点的解析
    element.children = parseChildren(context, ancestors)
    ancestors.pop()

    if(context.source.startsWith(`</${element.tag}`)) {
        parseTag(context, 'end')
    } else {
        // 缺少闭合标签
        console.log(`${element.tag} 标签缺少闭合标签`)
    }

    return element
}

function parseInterpolation(context) {
    // 消费开始定界符
    context.advanceBy('{{'.length)
    // 找到结束定界符的位置索引
    const closeIndex = context.source.indexOf('}}')
    if(closeIndex < 0) {
        console.error('插值缺少结束定界符')
    }
    // 截图开始定界符与结束定界符之间的内容作为插值表达式
    const content = context.source.slice(0, closeIndex)
    // 消费表达式的内容
    context.advanceBy(context.length)
    // 消费结束定界符
    context.advanceBy('}}'.length)

    // 返回类型为 Interpolation 的节点，代表插值节点
    return {
        type: 'Interpolation',
        context: context
    }
}

function parseText(context, ancestors) {
    // endIndex 为文本内容的结尾索引，默认将整个模板剩余内容都作为文本内容
    let endIndex = context.source.length
    // 寻找字符 < 的位置索引
    const ltIndex = context.source.indexOf('<')
    // 寻找定界符 {{ 的位置索引
    const delimiterIndex = context.source.indexOf('{{')

    // 取 ltIndex 和 当前 endIndex 中较小的一个作为新的结尾索引
    if(ltIndex > -1 && ltIndex < endIndex) {
        endIndex = ltIndex
    }

    if(delimiterIndex > -1 && delimiterIndex < endIndex) {
        endIndex = delimiterIndex
    }

    //此时endIndex是最终的文本内容的结尾索引，调用slice函数截取文本内容
    const content = context.source.slice(0, endIndex)
    // 消耗文本内容
    context.advanceBy(content.length)

    return {
        type: 'Text',
        content: content
    }
}

console.log(JSON.stringify(parse('<div><p>Vue</p><p>Template</p></div>')))