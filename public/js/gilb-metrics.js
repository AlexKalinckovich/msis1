import Parser from "tree-sitter";
import Scala from "tree-sitter-scala";

const parser = new Parser();
parser.setLanguage(Scala);

export function calculateGilbMetrics(code) {
    const tree = parser.parse(code);

    let cl = 0;
    let totalStatements = 0;
    let maxNesting = 0;

    const processedNodes = new Set();

    const statementTypes = new Set([
        'expression_statement',
        'val_definition',
        'var_definition',
        'function_definition',
        'if_expression',
        'match_expression',
        'for_expression',
        'while_expression',
        'return_expression',
        'throw_expression',
        'try_expression',
        'assignment_expression',
        'apply_expression'
    ]);

    const conditionalTypes = new Set([
        'if_expression',
        'match_expression',
        'for_expression',
        'while_expression',
        'case_clause',
        'do_while_expression',
        'guard'
    ]);

    function traverse(node, currentNesting = 0, inElseBranch = false) {
        if (processedNodes.has(node)) return;
        processedNodes.add(node);

        const nodeType = node.type;

        if (statementTypes.has(nodeType) &&
            !['case_clause'].includes(nodeType)) {
            totalStatements++;
        }

        maxNesting = Math.max(maxNesting, currentNesting);

        if (conditionalTypes.has(nodeType)) {
            if (nodeType === 'match_expression') {
                const caseClauses = findAllCases(node);
                cl += Math.max(0, caseClauses.length - 1);

                handleMatchExpression(node, currentNesting + 1);
                return;
            } else if (nodeType === 'if_expression') {
                if (!inElseBranch) {
                    cl++;
                }
                handleIfExpression(node, currentNesting, inElseBranch);
                return;
            } else if(nodeType === 'while_expression' || nodeType === 'do_while_expression') {
                cl++;
                handleWhileExpression(node, currentNesting);
                return;
            } else if(nodeType === 'for_expression') {
                cl++;
                handleForExpression(node, currentNesting);
                return;
            } else {
                cl++;
                const newNesting = currentNesting + 1;
                maxNesting = Math.max(maxNesting, newNesting);
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            traverse(node.child(i), currentNesting, inElseBranch);
        }
    }

    function handleIfExpression(node, currentNesting, inElseBranch) {
        let hasElse = false;
        let elseIfCount = 0;
        const newNesting = inElseBranch ? currentNesting : currentNesting + 1;

        if (!inElseBranch) {
            maxNesting = Math.max(maxNesting, newNesting);
        }

        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i);

            if (child.type === 'else') {
                hasElse = true;
                for (let j = 0; j < child.childCount; j++) {
                    const elseChild = child.child(j);
                    if (elseChild.type === 'if_expression') {
                        elseIfCount++;
                        cl++;
                        handleIfExpression(elseChild, newNesting, true);
                    } else {
                        traverse(elseChild, newNesting, false);
                    }
                }
            } else if (child.type === 'condition' || child.type === 'consequence') {
                traverse(child, newNesting, false);
            } else if (child.type !== 'if') {
                traverse(child, newNesting, false);
            }
        }

    }

    function handleMatchExpression(node, currentNesting) {
        const caseClauses = findAllCases(node);


        for (const caseClause of caseClauses) {
            traverse(caseClause, currentNesting + 1, false);
        }


        const matchValue = node.children.find(child =>
            child.type === 'identifier' ||
            child.type === 'parenthesized_expression'
        );
        if (matchValue) {
            traverse(matchValue, currentNesting, false);
        }
    }

    function handleForExpression(node, currentNesting) {
        const newNesting = currentNesting + 1;
        maxNesting = Math.max(maxNesting, newNesting);

        const enumerators = node.children.find(child => child.type === 'enumerators');
        if (enumerators) {
            traverse(enumerators, currentNesting, false);
        }

        const body = node.children.find(child =>
            child.type === 'block' ||
            child.type === 'expression'
        );
        if (body) {
            traverse(body, newNesting, false);
        }
    }

    function handleWhileExpression(node, currentNesting) {
        const newNesting = currentNesting + 1;
        maxNesting = Math.max(maxNesting, newNesting);

        const condition = node.children.find(child => child.type === 'parenthesized_expression');
        if (condition) {
            traverse(condition, currentNesting, false);
        }

        const body = node.children.find(child =>
            child.type === 'block' ||
            child.type === 'expression'
        );
        if (body) {
            traverse(body, newNesting, false);
        }
    }

    function findAllCases(node) {
        const cases = [];
        function findCasesRecursive(n) {
            if (n.type === 'case_clause') {
                cases.push(n);
            }
            for (let i = 0; i < n.childCount; i++) {
                findCasesRecursive(n.child(i));
            }
        }
        findCasesRecursive(node);
        return cases;
    }

    traverse(tree.rootNode, 0, false);

    const clRelative = totalStatements > 0 ? cl / totalStatements : 0;

    return {
        cl,
        clRelative: parseFloat(clRelative.toFixed(3)),
        cli: maxNesting,
        totalStatements
    };
}

export function analyzeCodeStructure(code) {
    const tree = parser.parse(code);
    const stats = {
        ifExpressions: 0,
        matchExpressions: 0,
        forExpressions: 0,
        whileExpressions: 0,
        functionDefinitions: 0,
        caseClauses: 0,
        totalNodes: 0,
        nodeTypes: new Map()
    };

    function traverse(node) {
        stats.totalNodes++;
        stats.nodeTypes.set(node.type, (stats.nodeTypes.get(node.type) || 0) + 1);

        switch (node.type) {
            case 'if_expression':
                stats.ifExpressions++;
                break;
            case 'match_expression':
                stats.matchExpressions++;
                break;
            case 'for_expression':
                stats.forExpressions++;
                break;
            case 'while_expression':
                stats.whileExpressions++;
                break;
            case 'function_definition':
                stats.functionDefinitions++;
                break;
            case 'case_clause':
                stats.caseClauses++;
                break;
        }

        for (let i = 0; i < node.childCount; i++) {
            traverse(node.child(i));
        }
    }

    traverse(tree.rootNode);
    stats.nodeTypes = Object.fromEntries(stats.nodeTypes);
    return stats;
}