import { emitLocalEvent } from './event-bus';
import 'panorama-polyfill-x/lib/console';

(() => {
    GameEvents.Subscribe(`x_net_table`, received_object => {
        const content = received_object.data;

        // 如果数据不是string，那么直接dispatch
        if (typeof content != 'string' && content.table_name != null) {
            dispatch(content.table_name, content.key, content.content);
            return;
        }

        if (typeof content != 'string') {
            throw new Error(`x_net_table data type error: ${typeof content}`);
        }

        // 如果字符串不是以#开头的，那么直接反序列化之后dispatch
        // 避免因为lua判断大小和json判断大小直接出现问题
        // 导致出错
        if (content.charAt(0) != '#') {
            try {
                const _table_object = JSON.parse(content) as XNetTableDataJSON;
                dispatch(_table_object.table, _table_object.key, _table_object.value);
            } catch {
                console.warn(`x_net_table dispatch error: ${content}`);
            }
            return;
        }

        // 如果是分割成多次发送的数据
        // 那么将他放到缓存中去，直到数据都接收完毕
        // 如果接收完毕了，那么合并数据再dispatch
        const defs = content.split('#');
        const unique_id = defs[1];
        const data_count = parseInt(defs[2]);
        const chunk_index = parseInt(defs[3]);
        // 有时候数据里面可能含有#，那么需要将剩下的数据拼接起来
        const chunk_data = defs.slice(4).join('#');
        GameUI.CustomUIConfig().__x_nettable_chunks_cache__ ??= {};
        GameUI.CustomUIConfig().__x_nettable_chunks_cache__[unique_id] ??= {};
        GameUI.CustomUIConfig().__x_nettable_chunks_cache__[unique_id][chunk_index] = chunk_data;
        if (Object.values(GameUI.CustomUIConfig().__x_nettable_chunks_cache__[unique_id]).length >= data_count) {
            // 将所有的数据按顺序拼接
            const res = Object.entries(GameUI.CustomUIConfig().__x_nettable_chunks_cache__[unique_id])
                .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                .map(v => v[1])
                .join('');

            try {
                const data = JSON.parse(res) as XNetTableDataJSON;
                dispatch(data.table, data.key, data.value);
            } catch {
                console.warn(`x_net_table dispatch error: ${res}`);
            }
        }
    });
})();

declare global {
    interface CustomUIConfig {
        // 数据缓存
        __x_nettable_cache__: {
            [table: string]: {
                [key: string]: any;
            };
        };
        // 数据碎片缓存
        __x_nettable_chunks_cache__: {
            [unique_id: string]: {
                [index: number]: string;
            };
        };
    }
}

/**
 * 比较两个值是否深度相等
 * 支持基本类型、对象、数组、Map 和 Set，同时处理循环引用
 *
 * @param prev 前一个值
 * @param next 后一个值
 * @param visited 用于记录已经访问过的对象，避免循环引用
 */
export function isEqual(prev: any, next: any, visited = new WeakMap()): boolean {
    // 处理基本类型和 null
    if (prev === next) return true;
    if (typeof prev !== 'object' || prev === null || typeof next !== 'object' || next === null) {
        return prev === next;
    }

    // 处理循环引用
    if (visited.has(prev)) {
        return visited.get(prev) === next;
    }
    visited.set(prev, next);

    // 处理数组
    if (Array.isArray(prev)) {
        if (!Array.isArray(next) || prev.length !== next.length) return false;
        for (let i = 0; i < prev.length; i++) {
            if (!isEqual(prev[i], next[i], visited)) return false;
        }
        return true;
    }

    // 处理普通对象
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    if (prevKeys.length !== nextKeys.length) return false;
    for (const key of prevKeys) {
        if (!next.hasOwnProperty(key) || !isEqual(prev[key], next[key], visited)) return false;
    }

    return true;
}

export function dispatch(table_name: string, key: string, content: any) {
    try {
        GameUI.CustomUIConfig().__x_nettable_cache__ ??= {};
        GameUI.CustomUIConfig().__x_nettable_cache__[table_name] ??= {};
        const prev = GameUI.CustomUIConfig().__x_nettable_cache__[table_name][key];
        if (!isEqual(prev, content)) {
            GameUI.CustomUIConfig().__x_nettable_cache__[table_name][key] = content;
            const table_data = {
                table_name,
                key,
                content,
            };
            // console.log(`x net table data updated ${table_name}->${key}`);
            emitLocalEvent(`x_net_table`, table_data);
        }
    } catch (error) {
        console.log(`x_net_table dispatch error: ${table_name} -> ${key} -> ${content}`);
    }
}
