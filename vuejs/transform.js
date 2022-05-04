// {
//     "type":"Root",
//     "children":[
//         {"type":"Element","tag":"div","props":[],"children":[{"type":"Element","tag":"p","props":[],"children":[{"type":"Text","content":"Vue"}],"isSelfClosing":false},
//         {"type":"Element","tag":"p","props":[],"children":[{"type":"Text","content":"Template"}],"isSelfClosing":false}],"isSelfClosing":false}
//     ]
// }
// 需要生成的渲染函数
// function render() {
//     return h('div',[
//         h('p','Vue'),
//         h('p','Template')
//     ])
// }

import { parse } from './parseCore.js'

function dump(node, indent = 0) {
    // 节点的类型
    const type = node.type
    // 节点的描述 如果是根节点则没有描述
    // 如果是ELement类型的节点，则使用 node.tag 作为节点的描述
    // 如果是 Text 类型的节点，则使用 node.content 作为节点的描述
    const desc = node.type === 'Root' ? ''
        : node.type === 'Element'
        ? node.tag
        : node.content
    // 打印节点的类型和描述信息
    console.log(`${'-'.repeat(indent)}${type}: ${desc}`)
    if(node.children) {
        node.children.forEach(v => dump(v, indent + 2))
    }
}


function traverseNode(ast, context = { }) {
    // 当前节点 ast 本身就是 Root节点
    context.currentNode = ast
    // 1. 增加退出阶段的回调函数数组
    const exitFns = []
    // 调用上下文的转换方法
    const transforms = context.nodeTransforms || []
    for(let i = 0; i < transforms.length; i++) {
        // 将当前节点 currentNode 和 context 都传递给 nodeTransforms 中注册的回调函数
        const onExit = transforms[i](context.currentNode, context)
        if(onExit){
            // 将退出阶段的回调函数添加到 exitFns 数组中
            exitFns.push(onExit)
        }
        // 如果当前节点被移除了 结束返回即可
        if(!context.currentNode) return
    }

    // 如果有子节点，则递归调用
    const children = context.currentNode.children

    if(children) {
        for(let i = 0; i < children.length; i++) {
            context.parent = context.currentNode
            context.childIndex = i
            traverseNode(children[i], context)
        }
    }

    let i = exitFns.length
    while(i--) {
        exitFns[i]()
    }
}

function transform(ast){
    const context = {
        // 增加 currentNode，用来存储当前正则转换的节点
        currentNode: null,
        parent: null,
        childIndex: -1, // 当前节点在父节点的 children 中的位置
        replaceNode(node) {
            // 将节点的父节点中children替换到
            context.parent.children[context.childIndex] = node
            // 当前节点替换掉
            context.currentNode = node
        },
        // 用于删除当前节点
        removeNode() {
            if(context.parent) {
                // 调用数组的splice方法 根据当前节点的索引删除当前节点
                context.parent.children.splice(context.childIndex,1)
                // 将 context.currentNode 置空
                context.currentNode = null
            }
        },
        nodeTransforms: [
            transformRoot, // 转换根节点
            transformElement, // 转换标签节点
            transformText // 转换文本节点
        ]
    }

    traverseNode(ast, context)
    console.log(JSON.stringify(ast))

}

function transformElement(node) {
    return () => {

        if(node.type !== 'Element') {
            return
        }

        // 1. 创建h函数调用语句
        const callExp = createCallExpression('h',[
            createStringLiteral(node.tag)
        ])
        // 2. 处理h函数调用的参数
        node.children.length === 1 
            ? callExp.arguments.push(node.children[0].jsNode)
            // 如果当前标签节点有多个子节点，则创建一个 ArrayExpresion节点作为参数
            : callExp.arguments.push(
                // 数组的每个元素都是子节点的 jsNode
                createArrayExpression(node.children.map(c => c.jsNode))
            )
        // 3. 将当前标签节点对应的javascript AST 添加到 jsNode 属性下
        node.jsNode = callExp

    }
}

function transformText(node) {
    if(node.type === 'text') {
        return
    }

    node.jsNode = createStringLiteral(node.content)
}

function transformRoot(node) {
    // 将逻辑编写在退出阶段的回调函数中，保证子节点全部被处理完毕
    return () => {
        if(node.type !== 'Root') {
            return
        }
        // node是根节点 根节点的第一个子节点就是模板的根节点
        // 当然，这里我们暂时不考虑模板存在多个根节点的情况
        const vnodeJSAST = node.children[0].jsNode
        // 创建 render 函数的声明语句节点，将 vnodeJSAST 作为 render 函数体的返回语句
        node.jsNode = {
            type: 'FunctionDecl',
            id: {
                type: 'Identifier',
                name: 'render'
            },
            params: [],
            body: [
                {
                    type: 'ReturnStatement',
                    return: vnodeJSAST
                }
            ]
        }
    }
}

const templateAST = parse('<div><p>Vue</p><p>Template</p></div>')
const jsAST = transform(templateAST)
console.log(JSON.stringify(jsAST))

// 需要生成的渲染函数
// function render() {
//     return h('div',[
//         h('p','Vue'),
//         h('p','Template')
//     ])
// }

// javascript AST
const FunctionDeclNode = {
    type: 'FunctionDecl', // 代表改节点是函数声明
    // 函数的名称是一个标识符，标识符本身也是一个节点
    id: {
        type: 'Identifier',
        name: 'render' // name用来存储标识符的名称，在这里它就是渲染函数的名称render
    },
    params: [], //参数 目前渲染函数还不需要参数，所以这里是一个空数组
    // 渲染函数的函数体只有一个语言,即 return 语句
    body: [
        {
            type: 'ReturnStatement',
            return: {
                type: 'CallExpression',
                callee: {
                    type: 'Identifier',
                    name: 'h'
                },
                arguments: [
                    // 第一个参数是字符串字面量'div'
                    {
                        type: 'StringLiteral',
                        value: 'div'
                    },
                    // 第二个参数是一个数组
                    {
                        type: 'ArrayExpression',
                        // 数组的第一个元素是h函数的调用
                        elements: [
                            {
                                type: 'CallExpression',
                                callee: {
                                    type: 'Identifier',
                                    name: 'h'
                                },
                                arguments: [
                                    // 该 h 函数调用的第一个参数是字符串字面量
                                    {
                                        type: 'StringLiteral',
                                        value: 'p'
                                    },
                                    // 第二个参数也是一个字符串字面量
                                    {
                                        type: 'StringLiteral',
                                        value: 'Vue'
                                    }
                                ]
                            },
                            // 数组的第二个元素也是h函数的调用
                            {
                                type: 'CallExpression',
                                callee: {
                                    type: 'Identifier',
                                    name: 'h'
                                },
                                arguments: [
                                    // 该h函数调用的第一个参数是字符串字面量
                                    {
                                        type: 'StringLiteral',
                                        value: 'p'
                                    },
                                    {
                                        type: 'StringLiteral',
                                        value: 'Template'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        }
    ]
}

// 用来创建 stringLiteral 节点
function createStringLiteral(value) {
    return {
        type: 'StringLiteral',
        value
    }
}

function createIdentifier(name) {
    return {
        type: 'Indentifier',
        name
    }
}

function createArrayExpression(elements) {
    return {
        type: 'AyyayExpression',
        elements
    }
}

function createCallExpression(callee, arg) {
    return {
        type: 'CallExpression',
        callee: createIdentifier(callee),
        arguments: arg
    }
}
