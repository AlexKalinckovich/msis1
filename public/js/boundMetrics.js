import Parser from "tree-sitter";
import Scala from "tree-sitter-scala";

const parser = new Parser();
parser.setLanguage(Scala);

function isChoiceNode(node) {
    const choiceNodeTypes = new Set([
        'if_expression',
        'match_expression',
        'for_expression',
        'while_expression',
    ]);
    return choiceNodeTypes.has(node.type);
}

function flattenAstToStatements(node, statementsList) {
    if (!node) {
        return;
    }

    const statementNodeTypes = new Set([
        'val_definition',
        'val_declaration',
        'var_definition',
        'var_declaration',
        'assignment_expression',
        'call_expression',
        'return_expression',
        'if_expression',
        'match_expression',
        'for_expression',
        'while_expression',
    ]);

    if (statementNodeTypes.has(node.type)) {
        statementsList.push(node);
    }

    for (let i = 0; i < node.childCount; i++) {
        flattenAstToStatements(node.child(i), statementsList);
    }
}

export function calculateBoundaryValueMetrics(code) {
    const tree = parser.parse(code);
    const rootNode = tree.rootNode;

    const linearStatements = [];
    flattenAstToStatements(rootNode, linearStatements);

    if (linearStatements.length === 0) {
        return {
            sa: 0,
            so: 0,
            totalVertices: 0,
            choiceVertices: 0,
            acceptingVertices: 0,
        };
    }

    const vertices = linearStatements.map((stmt, index) => ({
        id: index,
        node: stmt,
        type: stmt.type,
        text: stmt.text,
        successors: [],
        isChoice: isChoiceNode(stmt),
        adjustedComplexity: 0,
    }));

    const nodeToVertexMap = new Map();
    vertices.forEach(v => nodeToVertexMap.set(v.node, v));


    for (let i = 0; i < vertices.length; i++) {
        const currentVertex = vertices[i];
        const currentNode = currentVertex.node;

        if (currentNode.type === 'if_expression') {
            const thenClause = currentNode.child(2);
            const firstThenStatement = linearStatements.find(stmt => (stmt.startIndex >= thenClause.startIndex && stmt.endIndex <= thenClause.endIndex) || stmt === thenClause);
            if (firstThenStatement) {
                currentVertex.successors.push(nodeToVertexMap.get(firstThenStatement).id);
            }

            const elseClause = currentNode.namedChildren.find(c => c.type === 'else');
            if (elseClause) {
                const firstElseStatement = linearStatements.find(stmt => stmt.startIndex >= elseClause.startIndex && stmt.endIndex <= elseClause.endIndex);
                if (firstElseStatement) {
                    currentVertex.successors.push(nodeToVertexMap.get(firstElseStatement).id);
                }
            } else {
                if (i + 1 < vertices.length) {
                    currentVertex.successors.push(vertices[i + 1].id);
                }
            }

        } else if (currentNode.type === 'match_expression') {
            const caseClauses = currentNode.descendantsOfType('case_clause');
            for (const clause of caseClauses) {
                const firstStatementInCase = linearStatements.find(stmt => stmt.startIndex >= clause.startIndex && stmt.endIndex <= clause.endIndex);
                if (firstStatementInCase) {
                    currentVertex.successors.push(nodeToVertexMap.get(firstStatementInCase).id);
                }
            }

        } else if (currentNode.type === 'while_expression' || currentNode.type === 'for_expression') {
            const body = currentNode.child(currentNode.childCount - 1);
            const firstStatementInBody = linearStatements.find(stmt => stmt.startIndex >= body.startIndex && stmt.endIndex <= body.endIndex);
            if (firstStatementInBody) {
                currentVertex.successors.push(nodeToVertexMap.get(firstStatementInBody).id);
            }
            if (i + 1 < vertices.length) {
                currentVertex.successors.push(vertices[i + 1].id);
            }

        } else {
            if (i + 1 < vertices.length) {
                currentVertex.successors.push(vertices[i + 1].id);
            }
        }
    }

    for (const vertex of vertices) {
        if (vertex.isChoice) {
            const subgraphNodes = new Set();
            const queue = [...vertex.successors];
            const visited = new Set(queue);

            while (queue.length > 0) {
                const vertexId = queue.shift();
                if (vertexId === vertex.id) continue;

                subgraphNodes.add(vertexId);
                const targetVertex = vertices[vertexId];

                for (const successorId of targetVertex.successors) {
                    if (!visited.has(successorId)) {
                        visited.add(successorId);
                        queue.push(successorId);
                    }
                }
            }
            vertex.adjustedComplexity = subgraphNodes.size;

        } else {
            vertex.adjustedComplexity = 1;
        }
    }
    const terminalVertices = vertices.filter(v => v.successors.length === 0);
    for(const vertex of terminalVertices) {
        vertex.adjustedComplexity = 0;
    }


    const totalVerticesCount = vertices.length;

    const Sa = vertices.reduce((sum, vertex) => sum + vertex.adjustedComplexity, 0);

    const So = (totalVerticesCount > 1 && Sa > 0) ? (1 - (totalVerticesCount - 1) / Sa) : 0;

    const choiceVerticesCount = vertices.filter(v => v.isChoice).length;
    const acceptingVerticesCount = totalVerticesCount - choiceVerticesCount;

    return {
        sa: Math.round(Sa),
        so: parseFloat(So.toFixed(3)),
        totalVertices: totalVerticesCount,
        choiceVertices: choiceVerticesCount,
        acceptingVertices: acceptingVerticesCount,
    };
}

