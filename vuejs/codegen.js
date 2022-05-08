import { parse } from './parseCore.js'
import { transform } from './transform.js'

function generate(node) {
    const context = {
        // 存储最终生成的渲染函数
        code: '',
        // 在生成代码时，通过调用push函数完成代码的拼接
        push(code) {
            context.code += code;
        },
        // 当前缩进的级别，初始值为 0,即没有缩进
        currentIndex: 0,
        // 换行 并保留缩进
        newLine(){
            context.code += '\n' + `  `.repeat(context.currentIndex)
        },
        // 换行 并增加缩进
        indent() {
            context.currentIndex++
            context.newLine()
        },
        // 换行 并取消缩进
        deIndent() {
            context.currentIndex--
            context.newLine()
        }

    }

    // 调用 genNode 函数完成代码生成的工作
    genNode(node, context)

    // 返回渲染函数函数代码
    return context.code
}

function genNode(node, context) {
    switch (node.type) {
        case 'FunctionDecl':
            genFunctionDecl(node, context)
            break
        case 'ReturnStatement':
            genReturnStatement(node, context)
            break
        case 'CallExpression':
            genCallExpression(node, context)
            break
        case 'StringLiteral':
            genStringLiteral(node, context)
            break
        case 'ArrayExpression':
            genArrayExpression(node, context)
            break
    }
}

function genFunctionDecl(node, context){
    //从 context 对象中取出工具函数
    const { push, indent, deIndent } = context
    push(`function ${node.id.name}`)
    push('(')
    // 调用 genNodeList 为函数的参数生成代码
    genNodeList(node.params, context)
    push(')')
    push('{')
    // 换行并缩进
    indent()
    // 为函数体生成代码， 递归调用genNode函数
    node.body.forEach(n => genNode(n, context))
    // 取消缩进并换行
    deIndent()
    push('}')
}

function genNodeList(nodes, context) {
    const { push } = context
    for(let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        genNode(node, context)
        if(i < nodes.length - 1) {
            push(', ')
        }
    }
}

function genArrayExpression(node, context) {
    const { push } = context
    push('[')
    genNodeList(node.elements, context)
    push(']')
}

function genReturnStatement(node, context) {
    const { push } = context
    push('return ')
    genNode(node.return, context)
}

function genStringLiteral(node, context) {
    const { push } = context
    push(`'${node.value}'`)
}

function genCallExpression(node, context) {
    const { push } = context
    const { callee, arguments: args } = node
    push(`${callee.name}(`)
    // 生成函数参数
    genNodeList(args, context)
    push(')')
}

const ast = parse(`<div><p>Vue</p><p>Template</p></div>`)
transform(ast)
console.log(JSON.stringify(ast.jsNode))
const code = generate(ast.jsNode)
console.log(code)