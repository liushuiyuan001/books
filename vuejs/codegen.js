function generate(node) {
    const context = {
        code: '',
        push(code) {
            context.code += code;
        },
        // 当前
    }
}