#%%
"""
Numba优化版本的游戏模拟
关键数值计算使用numba加速
"""
import numpy as np
import random
import json
from numba import jit

# ==================== 自定义异常 ====================
class MegaPlacementImpossibleError(Exception):
    """当无法放置所有required的mega符号时抛出此异常"""
    pass

# 从data.js加载配置数据
def load_game_data():
    """加载游戏配置数据"""
    try:
        file_path = r'D:\IGame\瘋狂果醬罐\data.js'
        print(f"正在加载数据文件: {file_path}")
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            json_str = content.replace('const data = ', '').rstrip(';')
            data = json.loads(json_str)
            
            # 打印 DropWeight 的维度信息
            if 'DropWeight' in data:
                dw_array = np.array(data['DropWeight'])
                print(f"DropWeight 数据维度: {dw_array.shape}")
            if 'FreeDropWeight' in data:
                fdw_array = np.array(data['FreeDropWeight'])
                print(f"FreeDropWeight 数据维度: {fdw_array.shape}")
            
            return data
    except Exception as e:
        print(f"无法加载data.js: {e}")
        return None

GAME_DATA = load_game_data()

# ==================== 游戏常量 ====================
WILD_SYMBOL = 0  # Wild符号ID（万能符号）
CENTER_ROW = 3   # 中央位置：第4行
CENTER_COL = 6   # 中央位置：第7列

@jit(nopython=True, cache=True)
def get_wild_multiplier(eliminate_count):
    """获取Wild倍数（基于消除次数）
    
    序列：[1, 1, 2, 4, 6, 8, 10, 12, ..., 1000]
    - 前2次（index 0,1）：1
    - 之后每次+2：2, 4, 6, 8, ...
    - 上限：1000
    """
    if eliminate_count <= 1:
        return 1
    elif eliminate_count == 2:
        return 2
    else:
        # 从第3次开始：4, 6, 8, 10, ...
        mult = 2 + (eliminate_count - 2) * 2
        return min(mult, 1000)

# ==================== 六角网格配置 ====================
# 六角网格布局：[4,5,6,7,6,5,4]
# 每行的有效列坐标（用于判断相连）
HEX_GRID_COLS = [
    [3, 5, 7, 9],           # row 0: 4格
    [2, 4, 6, 8, 10],       # row 1: 5格
    [1, 3, 5, 7, 9, 11],    # row 2: 6格
    [0, 2, 4, 6, 8, 10, 12],# row 3: 7格
    [1, 3, 5, 7, 9, 11],    # row 4: 6格
    [2, 4, 6, 8, 10],       # row 5: 5格
    [3, 5, 7, 9]            # row 6: 4格
]

# 每行的格子数
HEX_ROW_SIZES = [4, 5, 6, 7, 6, 5, 4]

@jit(nopython=True, cache=True)
def get_row_size(row):
    """获取指定行的格子数"""
    sizes = np.array([4, 5, 6, 7, 6, 5, 4], dtype=np.int32)
    if 0 <= row < 7:
        return sizes[row]
    return 0

@jit(nopython=True, cache=True)
def index_to_col(row, index):
    """将行内索引转换为实际列坐标
    
    Args:
        row: 行号 (0-6)
        index: 行内索引 (0开始)
    
    Returns:
        实际列坐标
    """
    if row == 0:  # [3,5,7,9]
        cols = np.array([3, 5, 7, 9], dtype=np.int32)
    elif row == 1:  # [2,4,6,8,10]
        cols = np.array([2, 4, 6, 8, 10], dtype=np.int32)
    elif row == 2:  # [1,3,5,7,9,11]
        cols = np.array([1, 3, 5, 7, 9, 11], dtype=np.int32)
    elif row == 3:  # [0,2,4,6,8,10,12]
        cols = np.array([0, 2, 4, 6, 8, 10, 12], dtype=np.int32)
    elif row == 4:  # [1,3,5,7,9,11]
        cols = np.array([1, 3, 5, 7, 9, 11], dtype=np.int32)
    elif row == 5:  # [2,4,6,8,10]
        cols = np.array([2, 4, 6, 8, 10], dtype=np.int32)
    elif row == 6:  # [3,5,7,9]
        cols = np.array([3, 5, 7, 9], dtype=np.int32)
    else:
        cols = np.zeros(0, dtype=np.int32)
    
    if 0 <= index < len(cols):
        return cols[index]
    return -1

@jit(nopython=True, cache=True)
def col_to_index(row, col):
    """将实际列坐标转换为行内索引
    
    Args:
        row: 行号 (0-6)
        col: 实际列坐标
    
    Returns:
        行内索引，如果不是有效列则返回-1
    """
    if row == 0:  # [3,5,7,9]
        cols = np.array([3, 5, 7, 9], dtype=np.int32)
    elif row == 1:  # [2,4,6,8,10]
        cols = np.array([2, 4, 6, 8, 10], dtype=np.int32)
    elif row == 2:  # [1,3,5,7,9,11]
        cols = np.array([1, 3, 5, 7, 9, 11], dtype=np.int32)
    elif row == 3:  # [0,2,4,6,8,10,12]
        cols = np.array([0, 2, 4, 6, 8, 10, 12], dtype=np.int32)
    elif row == 4:  # [1,3,5,7,9,11]
        cols = np.array([1, 3, 5, 7, 9, 11], dtype=np.int32)
    elif row == 5:  # [2,4,6,8,10]
        cols = np.array([2, 4, 6, 8, 10], dtype=np.int32)
    elif row == 6:  # [3,5,7,9]
        cols = np.array([3, 5, 7, 9], dtype=np.int32)
    else:
        return -1
    
    for i in range(len(cols)):
        if cols[i] == col:
            return i
    return -1

@jit(nopython=True, cache=True)
def get_hex_neighbors(row, col):
    """获取六角网格中(row, col)的6个相邻格子坐标
    
    六角网格相邻方向：
    - 上左：(-1, -1)
    - 上右：(-1, +1)
    - 左：(0, -2)
    - 右：(0, +2)
    - 下左：(+1, -1)
    - 下右：(+1, +1)
    """
    neighbors = np.zeros((6, 2), dtype=np.int32)
    directions = np.array([
        [-1, -1],  # 上左
        [-1, +1],  # 上右
        [0, -2],   # 左
        [0, +2],   # 右
        [+1, -1],  # 下左
        [+1, +1]   # 下右
    ], dtype=np.int32)
    
    for i in range(6):
        neighbors[i, 0] = row + directions[i, 0]
        neighbors[i, 1] = col + directions[i, 1]
    
    return neighbors

@jit(nopython=True, cache=True)
def is_valid_hex_cell(row, col):
    """判断(row, col)是否是有效的六角网格位置"""
    if row < 0 or row > 6:
        return False
    
    # 检查col是否在该行的有效列中
    if row == 0:  # [3,5,7,9]
        return col in (3, 5, 7, 9)
    elif row == 1:  # [2,4,6,8,10]
        return col in (2, 4, 6, 8, 10)
    elif row == 2:  # [1,3,5,7,9,11]
        return col in (1, 3, 5, 7, 9, 11)
    elif row == 3:  # [0,2,4,6,8,10,12]
        return col in (0, 2, 4, 6, 8, 10, 12)
    elif row == 4:  # [1,3,5,7,9,11]
        return col in (1, 3, 5, 7, 9, 11)
    elif row == 5:  # [2,4,6,8,10]
        return col in (2, 4, 6, 8, 10)
    elif row == 6:  # [3,5,7,9]
        return col in (3, 5, 7, 9)
    
    return False

# ==================== Numba加速的核心函数 ====================

@jit(nopython=True, cache=True)
def weighted_choice_numba(weights):
    """numba优化的加权随机选择（整数权重，整数运算）"""
    total = np.sum(weights)
    r = np.random.randint(0, total)
    cumulative = 0
    for i in range(len(weights)):
        cumulative += weights[i]
        if r < cumulative:
            return i
    return len(weights) - 1

@jit(nopython=True, cache=True)
def bfs_find_connected(board, start_row, start_col, visited):
    """使用BFS查找相连的相同符号（六角网格版本，支持Wild符号）
    
    Wild符号规则：
    - Wild(0)可以与任何符号连通，作为桥梁连接同种符号
    - Wild不会被标记为visited，可以参与多个符号组
    - 但Wild最终只会被清除一次（由fixed_mask保护）
    """
    rows, cols = board.shape
    
    if visited[start_row, start_col] or board[start_row, start_col] == 0:
        return np.zeros((0, 2), dtype=np.int32)
    
    # 检查起始位置是否有效
    if not is_valid_hex_cell(start_row, start_col):
        return np.zeros((0, 2), dtype=np.int32)
    
    symbol = board[start_row, start_col]
    
    # 使用数组模拟队列
    max_size = rows * cols
    queue = np.zeros((max_size, 2), dtype=np.int32)
    queue[0, 0] = start_row
    queue[0, 1] = start_col
    q_front = 0
    q_back = 1
    
    result = np.zeros((max_size, 2), dtype=np.int32)
    result_size = 0
    
    # 用于防止Wild被重复加入队列（在同一次BFS中）
    wild_in_queue = np.zeros((rows, cols), dtype=np.bool_)
    
    visited[start_row, start_col] = True
    
    # 六角网格的六个方向：上左、上右、左、右、下左、下右
    directions = np.array([
        [-1, -1],  # 上左
        [-1, +1],  # 上右
        [0, -2],   # 左
        [0, +2],   # 右
        [+1, -1],  # 下左
        [+1, +1]   # 下右
    ], dtype=np.int32)
    
    while q_front < q_back:
        curr_r = queue[q_front, 0]
        curr_c = queue[q_front, 1]
        q_front += 1
        
        result[result_size, 0] = curr_r
        result[result_size, 1] = curr_c
        result_size += 1
        
        for d in range(6):
            next_r = curr_r + directions[d, 0]
            next_c = curr_c + directions[d, 1]
            
            # 检查是否在有效范围内且是有效的六角格子
            if 0 <= next_r < rows and 0 <= next_c < cols:
                if is_valid_hex_cell(next_r, next_c):
                    next_symbol = board[next_r, next_c]
                    
                    # 处理相同符号
                    if next_symbol == symbol:
                        if not visited[next_r, next_c]:
                            visited[next_r, next_c] = True
                            queue[q_back, 0] = next_r
                            queue[q_back, 1] = next_c
                            q_back += 1
                    # 处理Wild符号
                    elif next_symbol == 0:
                        # Wild不标记visited（可以被多个组使用）
                        # 但在当前BFS中只加入队列一次
                        if not wild_in_queue[next_r, next_c]:
                            wild_in_queue[next_r, next_c] = True
                            queue[q_back, 0] = next_r
                            queue[q_back, 1] = next_c
                            q_back += 1
    
    return result[:result_size]

@jit(nopython=True, cache=True)
def select_my_targets_numba(my_weights):
    """按顺序抽选MY1→MY2→MY3目标符号，确保三种MY各不相同

    - MY1: 从完整权重抽选
    - MY2: 将MY1目标权重设为0后抽选（不与MY1重复）
    - MY3: 将MY1、MY2目标权重都设为0后抽选（不与MY1、MY2重复）
    """
    num_my = min(3, len(my_weights))
    my_targets = np.full(3, -1, dtype=np.int32)

    for my_idx in range(num_my):
        # 复制当前MY的权重，避免修改原始数据
        current_weights = my_weights[my_idx].copy()

        # 将之前已选中符号的权重设为0
        for prev_idx in range(my_idx):
            prev_symbol = my_targets[prev_idx]
            if 0 <= prev_symbol < len(current_weights):
                current_weights[prev_symbol] = 0

        # 从剩余权重中抽选
        total = np.sum(current_weights)
        if total > 0:
            my_targets[my_idx] = weighted_choice_numba(current_weights)
        else:
            # fallback：找一个未使用的符号
            for s in range(len(current_weights)):
                already_used = False
                for prev_idx in range(my_idx):
                    if my_targets[prev_idx] == s:
                        already_used = True
                        break
                if not already_used:
                    my_targets[my_idx] = s
                    break

    return my_targets

@jit(nopython=True, cache=True)
def convert_my_numba(board, my_weights):
    """转换MY符号(9,10,11)为不同符号（六角网格版本）

    按顺序抽选MY1→MY2→MY3，确保三种MY各不相同
    """
    rows, cols = board.shape

    my_targets = select_my_targets_numba(my_weights)

    # 统一转换所有MY符号（按行内索引顺序处理）
    for row in range(rows):
        row_size = get_row_size(row)
        for index in range(row_size):
            col = index_to_col(row, index)
            symbol = board[row, col]
            if 9 <= symbol <= 11:
                my_idx = symbol - 9
                if my_idx < len(my_weights) and my_targets[my_idx] >= 0:
                    board[row, col] = my_targets[my_idx]

@jit(nopython=True, cache=True)
def convert_my_numba_with_targets(board, my_targets):
    """使用预先确定的目标转换MY符号（六角网格版本）"""
    rows, cols = board.shape
    for row in range(rows):
        row_size = get_row_size(row)
        for index in range(row_size):
            col = index_to_col(row, index)
            symbol = board[row, col]
            if 9 <= symbol <= 11:
                my_idx = symbol - 9
                if my_idx < len(my_targets):
                    board[row, col] = my_targets[my_idx]

@jit(nopython=True, cache=True)
def fix_c1_numba(board):
    """确保每行最多1个C1（六角网格版本）

    多余的C1转换为M7(8)，而非MY1，避免需要再次MY转换
    """
    rows, cols = board.shape
    for row in range(rows):
        c1_count = 0
        row_size = get_row_size(row)
        for index in range(row_size):
            col = index_to_col(row, index)
            if board[row, col] == 1:
                if c1_count > 0:
                    board[row, col] = 8  # 转换为M7
                c1_count += 1

@jit(nopython=True, cache=True)
def drop_symbols_numba(board, fixed_mask):
    """符号垂直掉落（六角网格版本）
    
    使用行内索引处理掉落，符号在每行内连续移动
    """
    rows, cols = board.shape
    
    # 每行独立处理掉落
    for row in range(rows):
        row_size = get_row_size(row)
        
        # 收集非空且非固定的符号（按行内索引顺序）
        non_empty_symbols = np.zeros(row_size, dtype=np.int32)
        symbol_count = 0
        
        for index in range(row_size):
            col = index_to_col(row, index)
            if not fixed_mask[row, col] and board[row, col] != 0:
                non_empty_symbols[symbol_count] = board[row, col]
                symbol_count += 1
        
        # 从左往右填充（符号掉到左边）
        idx = 0
        for index in range(row_size):
            col = index_to_col(row, index)
            if not fixed_mask[row, col]:
                if idx < symbol_count:
                    board[row, col] = non_empty_symbols[idx]
                    idx += 1
                else:
                    board[row, col] = 0

@jit(nopython=True, cache=True)
def initialize_board_numba(board, reel_symbols, reel_weights):
    """使用numba加速初始化版面（六角网格版本）
    
    使用行内索引顺序填充，符号连续排列
    第3行（7格）取连续7个符号，中央位置替换为WILD
    """
    rows, cols = board.shape
    
    for row in range(rows):
        reel_row = reel_symbols[row]
        weight_row = reel_weights[row]
        
        start_idx = weighted_choice_numba(weight_row)
        reel_len = len(reel_row)
        row_size = get_row_size(row)
        
        # 按行内索引顺序填充
        for index in range(row_size):
            col = index_to_col(row, index)
            
            # 第3行的中央位置（index=3, col=6）设置为WILD
            if row == 3 and index == 3:
                board[row, col] = 0  # WILD_SYMBOL
            else:
                symbol_value = reel_row[(start_idx + index) % reel_len]
                # 符号表现在是整数，直接使用，0视为C1
                if symbol_value == 0:
                    symbol_id = 1
                else:
                    symbol_id = symbol_value
                board[row, col] = symbol_id

@jit(nopython=True, cache=True)
def fill_empty_method0_numba(board, fixed_mask, drop_table, drop_rweights):
    """填充方法0：每行独立加权抽取轮带起始位置（六角网格版本）
    
    使用行内索引顺序填充空位，符号连续排列
    """
    rows, cols = board.shape
    
    # 每行独立抽取轮带的一段
    for row in range(rows):
        drop_row = drop_table[row]
        drop_weight_row = drop_rweights[row]
        drop_len = len(drop_row)
        
        # 为当前行抽取轮带的起始位置
        start_idx = weighted_choice_numba(drop_weight_row)
        offset = 0  # 轮带偏移量
        row_size = get_row_size(row)
        
        # 按行内索引顺序扫描，填充空位
        for index in range(row_size):
            col = index_to_col(row, index)
            if board[row, col] == 0 and not fixed_mask[row, col]:
                # 从轮带的起始位置开始顺序取符号
                symbol_value = drop_row[(start_idx + offset) % drop_len]
                offset += 1  # 轮带移动一个位置
                
                # 符号表现在是整数，0视为C1
                if symbol_value == 0:
                    symbol_id = 1
                else:
                    symbol_id = symbol_value
                
                board[row, col] = symbol_id

@jit(nopython=True, cache=True)
def fill_empty_method1_numba(board, fixed_mask, drop_table, position_idx):
    """填充方法1：所有行从相同起始位置开始（六角网格版本）
    
    使用行内索引顺序填充空位，符号连续排列
    """
    rows, cols = board.shape
    
    for row in range(rows):
        drop_row = drop_table[row]
        drop_len = len(drop_row)
        offset = 0  # 当前行的偏移量
        row_size = get_row_size(row)
        
        # 按行内索引顺序扫描
        for index in range(row_size):
            col = index_to_col(row, index)
            if board[row, col] == 0 and not fixed_mask[row, col]:
                # 使用 position_idx + offset，循环取值
                symbol_value = drop_row[(position_idx + offset) % drop_len]
                offset += 1  # 下一个空格使用下一个位置
                
                # 符号表现在是整数，0视为C1
                if symbol_value == 0:
                    symbol_id = 1
                else:
                    symbol_id = symbol_value

                board[row, col] = symbol_id

@jit(nopython=True, cache=True)
def calculate_match_score_numba(linkpoint, board, positions_flat, num_positions):
    """计算单个匹配的分数（numba优化）"""
    if num_positions == 0:
        return 0
    
    # 获取符号和计数
    symbol = board[positions_flat[0, 0], positions_flat[0, 1]]
    count = num_positions
    
    # 获取基础分数
    symbol_idx = symbol - 2
    count_idx = min(count - 6, 10)
    if 0 <= symbol_idx < linkpoint.shape[0] and 0 <= count_idx < linkpoint.shape[1]:
        base_score = linkpoint[symbol_idx, count_idx]
    else:
        base_score = 0
    
    return base_score

@jit(nopython=True, cache=True)
def clear_positions_numba(board, positions_flat, num_positions):
    """清除指定位置的符号（numba优化，保护中央Wild符号）"""
    for i in range(num_positions):
        row = positions_flat[i, 0]
        col = positions_flat[i, 1]
        # 跳过中央Wild位置[3,6]
        if row == 3 and col == 6:
            continue
        board[row, col] = 0

@jit(nopython=True, cache=True)
def find_all_matches_numba(board):
    """查找所有需要消除的符号组（6个或以上相连）- numba优化"""
    rows, cols = board.shape
    visited = np.zeros((rows, cols), dtype=np.bool_)
    
    # 最多可能有 rows*cols 个匹配
    max_matches = rows * cols
    match_symbols = np.zeros(max_matches, dtype=np.int32)
    match_counts = np.zeros(max_matches, dtype=np.int32)
    # 存储所有匹配位置（扁平化）
    all_positions = np.zeros((max_matches * rows * cols, 2), dtype=np.int32)
    position_starts = np.zeros(max_matches, dtype=np.int32)
    
    num_matches = 0
    total_positions = 0
    
    for i in range(rows):
        for j in range(cols):
            if not visited[i, j] and board[i, j] != 0:
                connected = bfs_find_connected(board, i, j, visited)
                
                if len(connected) >= 6:
                    match_symbols[num_matches] = board[i, j]
                    match_counts[num_matches] = len(connected)
                    position_starts[num_matches] = total_positions
                    
                    # 保存位置
                    for k in range(len(connected)):
                        all_positions[total_positions + k, 0] = connected[k, 0]
                        all_positions[total_positions + k, 1] = connected[k, 1]
                    
                    total_positions += len(connected)
                    num_matches += 1
    
    return num_matches, match_symbols[:num_matches], match_counts[:num_matches], all_positions[:total_positions], position_starts[:num_matches]
    
@jit(nopython=True, cache=True)
def process_all_matches_numba(board, fixed_mask, linkpoint, match_symbols, match_counts, 
                               all_positions, position_starts, num_matches, wild_eliminate_count):
    """处理所有匹配：计算分数、清除符号、解除固定格子（numba优化）
    
    同一次cascade可能包含多组符号消除，每组独立判断：
    - 含Wild的组：使用 基底分数 × Wild倍数
    - 不含Wild的组：使用 基底分数 × 1
    
    Args:
        wild_eliminate_count: Wild参与消除的累计次数（用于计算Wild倍数）
    
    Returns:
        total_score, final_scores, wild_group_count（包含中央Wild的符号组数量）
    """
    total_score = 0
    final_scores = np.zeros(num_matches, dtype=np.int32)
    wild_group_count = 0  # 统计包含中央Wild的符号组数量
    
    # 遍历每个符号组，独立计算分数
    for match_idx in range(num_matches):
        symbol = match_symbols[match_idx]
        count = match_counts[match_idx]
        
        # 获取这个匹配的位置范围
        start_pos = position_starts[match_idx]
        if match_idx < num_matches - 1:
            end_pos = position_starts[match_idx + 1]
        else:
            end_pos = len(all_positions)
        
        # 检查当前这一组是否包含中央Wild [3,6]
        # 注意：每组独立判断，同一次cascade中不同组可能有不同结果
        has_central_wild = False
        for pos_idx in range(start_pos, end_pos):
            if all_positions[pos_idx, 0] == 3 and all_positions[pos_idx, 1] == 6:
                has_central_wild = True
                wild_group_count += 1  # 统计包含Wild的组数
                break
        
        # 获取基础分数
        symbol_idx = symbol - 2
        count_idx = min(count - 6, 10)
        if 0 <= symbol_idx < linkpoint.shape[0] and 0 <= count_idx < linkpoint.shape[1]:
            base_score = linkpoint[symbol_idx, count_idx]
        else:
            base_score = 0
        
        # 计算最终分数：
        # - 不含WILD：基底分数 × 1
        # - 含WILD：基底分数 × WILD倍数
        # 
        # 示例（同一次cascade）：
        #   组1: 7个M1含Wild，基底1000 → 1000 × Wild倍数
        #   组2: 6个M2不含Wild，基底500 → 500 × 1 = 500
        #   组3: 8个M3含Wild，基底1500 → 1500 × Wild倍数
        if has_central_wild:
            wild_mult = get_wild_multiplier(wild_eliminate_count)
            final_score = base_score * wild_mult
        else:
            final_score = base_score * 1
        
        # 清除符号并解除固定状态（但保留中央Wild符号）
        for pos_idx in range(start_pos, end_pos):
            row = all_positions[pos_idx, 0]
            col = all_positions[pos_idx, 1]
            # 跳过中央Wild位置[3,6]
            if row == 3 and col == 6:
                continue
            board[row, col] = 0
            fixed_mask[row, col] = False  # 解除固定格子
        
        final_scores[match_idx] = final_score
        total_score += final_score
    
    return total_score, final_scores, wild_group_count

# ==================== 游戏类（使用numba加速函数）====================

class Game7x7:
    def __init__(self, symbols=None, linkpoint=None, reel_set=None, drop_set=None, is_free_game=False):
        """初始化六角网格游戏 [4,5,6,7,6,5,4]
        
        Args:
            symbols: 符号列表
            linkpoint: 得分表
            reel_set: 指定使用的Reel参数集
            drop_set: 指定使用的Drop参数集
            is_free_game: 是否为Free Game模式（使用FreeGame参数）
        """
        self.rows = 7
        self.cols = 13  # 六角网格最宽行需要13列
        self.symbols = symbols if symbols else list(range(2, 9))
        self.board = np.zeros((self.rows, self.cols), dtype=np.int32)
        self.fixed_mask = np.zeros((self.rows, self.cols), dtype=np.bool_)
        self.score = 0
        self.fixed_cells = set()
        self.is_free_game = is_free_game  # Free Game模式标志
        
        # Wild符号倍数系统
        self.wild_eliminate_count = 0  # Wild参与消除的次数（用于倍数升级）
        
        # Mega Eliminate系统（新）
        self.mega_level = 0  # Mega等级（0, 1, 2），每次消除+1
        self.mega_eliminate_count = 0  # Mega消除计数（上限3），每完成2级（0->2）+1
        
        # 2×2统计（在六角网格中，实际是4格钻石形状）
        self.eliminate_trigger_count = 0  # 触发判断次数
        self.eliminate_success_count = 0  # 成功放置次数
        self.eliminate_fail_count = 0     # 放置失败次数（无法放置任何block）
        self.score_before_eliminate = 0   # 触发2×2前的得分
        self.score_from_eliminate = 0     # 2×2带来的额外得分
        
        # 选择使用的Reel参数集
        if reel_set is None:
            self.reel_set = self.select_reel_by_weight()
        else:
            self.reel_set = reel_set
        
        # 选择使用的Drop参数集
        if drop_set is None:
            self.drop_set = self.select_drop_by_weight(eliminate_count=0)
        else:
            self.drop_set = drop_set
        
        # 加载linkpoint得分表
        if linkpoint is None:
            if GAME_DATA and 'linkpoint' in GAME_DATA:
                self.linkpoint = np.array(GAME_DATA['linkpoint'], dtype=np.int32)
            else:
                self.linkpoint = np.array([
                    [10000, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
                    [15000, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65],
                    [20000, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
                    [25000, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75],
                    [30000, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80],
                    [35000, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85],
                    [40000, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90],
                ], dtype=np.int32)
        else:
            self.linkpoint = np.array(linkpoint, dtype=np.int32)
        
        self.load_reel_data()
        self.load_drop_data()
        self.load_eliminate_data()
        self.eliminate_count = 0
    
    def select_reel_by_weight(self):
        """按照ReelWeight权重选择使用哪一套参数(1-5)"""
        if self.is_free_game:
            weight_key = 'FreeReelWeight'
        else:
            weight_key = 'ReelWeight'
        
        if GAME_DATA and weight_key in GAME_DATA:
            # 将权重转为整数（乘以10000保持精度）
            reel_weights = np.array(GAME_DATA[weight_key], dtype=np.float32)
            reel_weights = (reel_weights * 10000).astype(np.int32)
            idx = weighted_choice_numba(reel_weights)
            return idx + 1
        else:
            return random.randint(1, 5)
    
    def select_drop_by_weight(self, eliminate_count=0):
        """按照DropWeight权重选择使用哪一套掉落参数(1-6)
        
        Args:
            eliminate_count: 当前消除次数，用于选择权重行
                - 第1次: 使用第0行
                - 第2次: 使用第1行
                - 第3次: 使用第2行
                - 第4次: 使用第3行
                - 第5次: 使用第4行
                - 第6次: 使用第5行
                - 第7次: 使用第6行
                - 第8次: 使用第7行
                - 第9次: 使用第8行
                - 第10+次: 使用第9行
        """
        if self.is_free_game:
            weight_key = 'FreeDropWeight'
        else:
            weight_key = 'DropWeight'
        
        if GAME_DATA and weight_key in GAME_DATA:
            drop_weights_2d = np.array(GAME_DATA[weight_key], dtype=np.float32)
            
            # 根据消除次数选择对应的权重行（10行格式）
            if eliminate_count <= 0:
                row_idx = 0  # 初始化时使用第0行（第1次）
            elif eliminate_count >= 10:
                row_idx = 9  # 第10+次消除使用第9行
            else:
                row_idx = eliminate_count - 1  # 第1次用第0行，第2次用第1行...
            
            # 获取对应行的权重
            drop_weights = drop_weights_2d[row_idx]
            drop_weights = (drop_weights * 10000).astype(np.int32)
            idx = weighted_choice_numba(drop_weights)
            return idx + 1
        else:
            return random.randint(1, 6)
    
    def load_reel_data(self):
        """加载对应reel_set的数据"""
        if GAME_DATA:
            if self.is_free_game:
                prefix = 'FreeGame'
            else:
                prefix = 'baseGame'
            reel_key = f'{prefix}Symbol{self.reel_set}'
            weight_key = f'{prefix}SymbolWeight{self.reel_set}'
            my_key = f'{prefix}MY{self.reel_set}'
            
            # 符号表转为int32
            self.reel_symbols = np.array(GAME_DATA.get(reel_key, []), dtype=np.int32)
            # 权重转为整数（乘以10000保持精度）
            reel_weights = np.array(GAME_DATA.get(weight_key, []), dtype=np.float32)
            self.reel_weights = (reel_weights * 10000).astype(np.int32)
            my_weights = np.array(GAME_DATA.get(my_key, []), dtype=np.float32)
            self.my_weights = (my_weights * 10000).astype(np.int32)
        else:
            self.reel_symbols = None
            self.reel_weights = None
            self.my_weights = None
    
    def load_drop_data(self):
        """加载对应drop_set的掉落数据"""
        if GAME_DATA:
            if self.is_free_game:
                prefix = 'FreeGameDrop'
            else:
                prefix = 'BaseGameDrop'
            drop_key = f'{prefix}{self.drop_set}'
            drop_rweight_key = f'{prefix}RWeight{self.drop_set}'
            drop_pweight_key = f'{prefix}PWeight{self.drop_set}'
            drop_method_key = f'{prefix}method{self.drop_set}'
            drop_my_key = f'{prefix}My{self.drop_set}'
            
            # 符号表转为int32
            self.drop_symbol_table = np.array(GAME_DATA.get(drop_key, []), dtype=np.int32)
            # 权重转为整数（乘以10000保持精度）
            drop_rweights = np.array(GAME_DATA.get(drop_rweight_key, []), dtype=np.float32)
            self.drop_rweights = (drop_rweights * 10000).astype(np.int32)
            drop_pweights = np.array(GAME_DATA.get(drop_pweight_key, []), dtype=np.float32)
            self.drop_pweights = (drop_pweights * 10000).astype(np.int32)
            drop_method_weights = np.array(GAME_DATA.get(drop_method_key, []), dtype=np.float32)
            self.drop_method_weights = (drop_method_weights * 10000).astype(np.int32)
            drop_my_weights = np.array(GAME_DATA.get(drop_my_key, []), dtype=np.float32)
            self.drop_my_weights = (drop_my_weights * 10000).astype(np.int32)
        else:
            self.drop_symbol_table = None
            self.drop_rweights = None
            self.drop_pweights = None
            self.drop_method_weights = None
            self.drop_my_weights = None
    
    def load_eliminate_data(self):
        """加载Eliminate特色数据"""
        if GAME_DATA:
            # 根据游戏模式选择参数前缀
            # Base Game 使用 'Eliminate'，Free Game 使用 'FreeEliminate'
            if self.is_free_game:
                eliminate_symbol_key = 'FreeEliminate'
            else:
                eliminate_symbol_key = 'Eliminate'
            
            # 新的Mega系统使用 Eliminate/FreeEliminate 作为符号权重
            if eliminate_symbol_key in GAME_DATA:
                eliminate_symbol = np.array(GAME_DATA[eliminate_symbol_key], dtype=np.float32)
                self.eliminate_symbol = (eliminate_symbol * 10000).astype(np.int32)
            else:
                # 如果没有对应字段，使用默认权重（所有符号相等）
                # 符号2-8，共7个符号
                default_weights = np.array([1000.0] * 7, dtype=np.float32)
                self.eliminate_symbol = (default_weights * 10000).astype(np.int32)
                print(f"警告：未找到 {eliminate_symbol_key}，使用默认符号权重")
            
            # 保留旧的字段（向后兼容，但新系统不使用）
            self.eliminate_trigger = None
            self.eliminate_time = None
        else:
            # 使用默认值
            default_weights = np.array([1000.0] * 7, dtype=np.float32)
            self.eliminate_symbol = (default_weights * 10000).astype(np.int32)
            self.eliminate_trigger = None
            self.eliminate_time = None
    
    def initialize_board(self):
        """初始化游戏版面（六角网格版本）"""
        if self.reel_symbols is None or self.reel_weights is None:
            # 简单随机初始化（按行内索引顺序）
            for row in range(self.rows):
                row_size = HEX_ROW_SIZES[row]
                for index in range(row_size):
                    col = HEX_GRID_COLS[row][index]
                    self.board[row][col] = random.choice(self.symbols)
        else:
            # 使用numba加速初始化
            initialize_board_numba(self.board, self.reel_symbols, self.reel_weights)
            
            if self.my_weights is not None and len(self.my_weights) > 0:
                convert_my_numba(self.board, self.my_weights)
            
            # 确保每行最多1个C1
            fix_c1_numba(self.board)
        
        # 设置中央位置为固定Wild符号
        self.board[CENTER_ROW, CENTER_COL] = WILD_SYMBOL
        self.fixed_mask[CENTER_ROW, CENTER_COL] = True
        self.fixed_cells.add((CENTER_ROW, CENTER_COL))
        
        return self.board
    
    def find_connected_symbols(self, row, col, visited):
        """使用BFS查找从(row, col)开始的所有相连相同符号（numba加速）"""
        connected_array = bfs_find_connected(self.board, row, col, visited)
        return [(int(connected_array[i, 0]), int(connected_array[i, 1])) for i in range(len(connected_array))]
    
    def find_all_matches(self):
        """查找所有需要消除的符号组（6个或以上相连）- 使用numba加速"""
        num_matches, match_symbols, match_counts, all_positions, position_starts = find_all_matches_numba(self.board)
        
        if num_matches == 0:
            return []
        
        # 转换为原格式以兼容现有代码
        matches = []
        for i in range(num_matches):
            start_pos = position_starts[i]
            if i < num_matches - 1:
                end_pos = position_starts[i + 1]
            else:
                end_pos = len(all_positions)
            
            positions = [(int(all_positions[j, 0]), int(all_positions[j, 1])) 
                        for j in range(start_pos, end_pos)]
            
            matches.append((int(match_symbols[i]), int(match_counts[i]), positions))
        
        return matches
    
    def find_all_matches_fast(self):
        """快速查找所有匹配（返回numba格式，用于批处理）"""
        return find_all_matches_numba(self.board)
    
    def get_base_score(self, symbol, count):
        """从linkpoint获取基础分数"""
        symbol_idx = symbol - 2
        count_idx = min(count - 6, 10)
        
        if 0 <= symbol_idx < len(self.linkpoint) and 0 <= count_idx < len(self.linkpoint[0]):
            return int(self.linkpoint[symbol_idx, count_idx])
        return 0
    
    def remove_symbols_and_score(self, matches):
        """消除符号并计算得分（numba加速）"""
        total_removed = 0
        total_score = 0
        details = []
        
        for symbol, count, positions in matches:
            # 转换positions为numpy数组
            positions_array = np.array(positions, dtype=np.int32)
            
            # 使用numba计算分数
            score = calculate_match_score_numba(
                self.linkpoint, self.board,
                positions_array, len(positions)
            )
            
            # 清除符号
            clear_positions_numba(self.board, positions_array, len(positions))
            
            total_removed += len(positions)
            total_score += score
            
            details.append({
                'symbol': f'M{symbol-1}',
                'count': count,
                'score': score,
                'positions': positions
            })
        
        return total_removed, total_score, details
    
    def remove_symbols_and_score_fast(self, num_matches, match_symbols, match_counts, 
                                       all_positions, position_starts):
        """快速批处理版本：消除符号并计算得分（完全numba优化）"""
        if num_matches == 0:
            return 0, 0, [], 0
        
        total_score, final_scores, wild_group_count = process_all_matches_numba(
            self.board, self.fixed_mask, self.linkpoint,
            match_symbols, match_counts, all_positions, position_starts, num_matches,
            self.wild_eliminate_count
        )
        
        total_removed = np.sum(match_counts)
        
        # 构建详情（用于调试/记录）
        details = []
        for i in range(num_matches):
            start_pos = position_starts[i]
            if i < num_matches - 1:
                end_pos = position_starts[i + 1]
            else:
                end_pos = len(all_positions)
            
            positions = [(int(all_positions[j, 0]), int(all_positions[j, 1])) 
                        for j in range(start_pos, end_pos)]
            
            details.append({
                'symbol': f'M{int(match_symbols[i])-1}',
                'count': int(match_counts[i]),
                'score': int(final_scores[i]),
                'positions': positions
            })
        
        return int(total_removed), int(total_score), details, wild_group_count
    
    def drop_symbols(self):
        """让符号向下掉落填补空位（numba加速）"""
        drop_symbols_numba(self.board, self.fixed_mask)
    
    def fill_empty_spaces(self):
        """用新符号填充空位（六角网格版本）"""
        if self.drop_symbol_table is None or self.drop_method_weights is None:
            # 简单随机填充（按行内索引顺序）
            for row in range(self.rows):
                row_size = HEX_ROW_SIZES[row]
                for index in range(row_size):
                    col = HEX_GRID_COLS[row][index]
                    if self.board[row, col] == 0 and not self.fixed_mask[row, col]:
                        self.board[row, col] = random.choice(self.symbols)
        else:
            # 每次填充都重新选择drop_set（1-6），根据当前消除次数
            self.drop_set = self.select_drop_by_weight(self.eliminate_count)
            self.load_drop_data()
            
            # 选择填充方法
            drop_method = weighted_choice_numba(self.drop_method_weights)
            
            if drop_method == 0:
                # 使用numba加速的方法0
                fill_empty_method0_numba(self.board, self.fixed_mask,
                                        self.drop_symbol_table, self.drop_rweights)
            else:
                # 使用numba加速的方法1
                position_idx = weighted_choice_numba(self.drop_pweights)
                fill_empty_method1_numba(self.board, self.fixed_mask,
                                        self.drop_symbol_table, position_idx)
            
            # 本次填充：按顺序抽选MY目标（MY1→MY2→MY3各不相同）
            if self.drop_my_weights is not None and len(self.drop_my_weights) > 0:
                my_targets = select_my_targets_numba(self.drop_my_weights)
                convert_my_numba_with_targets(self.board, my_targets)
            
            fix_c1_numba(self.board)
    
    def process_cascades(self):
        cascade_count = 0
        total_removed = 0
        total_score = 0
        all_details = []
        first_eliminate_triggered = False  # 标记是否已触发过2×2
        
        while True:
            # 使用快速版本查找匹配
            num_matches, match_symbols, match_counts, all_positions, position_starts = self.find_all_matches_fast()
            
            if num_matches == 0:
                # 只在第一次触发2×2前记录分数
                if not first_eliminate_triggered:
                    self.score_before_eliminate = total_score
                    first_eliminate_triggered = True
                
                if self.try_eliminate_feature():
                    continue
                else:
                    break
            
            # 使用快速版本处理匹配
            removed, score, details, wild_group_count = self.remove_symbols_and_score_fast(
                num_matches, match_symbols, match_counts, all_positions, position_starts
            )
            
            # 如果消除包含Wild，升级Wild倍数
            if wild_group_count > 0:
                self.wild_eliminate_count += 1
            
            # Mega系统：只有包含Wild的消除才升级mega_level
            # 当mega_eliminate_count达到3时，维持在0不再提升，保证每次循环上限为3个mega符号
            if wild_group_count > 0 and self.mega_eliminate_count < 3:
                # 计算增加量（wild帮助1组=+1，2+组=+2）
                mega_increase = min(wild_group_count, 2)
                
                # 提升mega_level，但不超过上限2
                self.mega_level = min(self.mega_level + mega_increase, 2)
                
                # 如果达到2级，完成一个循环
                if self.mega_level == 2:
                    self.mega_eliminate_count += 1
                    self.mega_level = 0  # 重置为0
                    # 注意：如果此时mega_eliminate_count达到3，下次消除将不再提升mega_level
            
            total_removed += removed
            total_score += score
            cascade_count += 1
            self.eliminate_count += 1
            
            all_details.append({
                'cascade': cascade_count,
                'matches': details
            })
            
            self.drop_symbols()
            self.fill_empty_spaces()
        
        return cascade_count, total_removed, total_score, all_details
    
    def play_round(self, keep_multipliers=False):
        """执行一轮游戏
        
        Args:
            keep_multipliers: 是否保留倍数（Free Game模式下为True）
        """
        self.eliminate_count = 0
        self.fixed_cells.clear()
        self.fixed_mask[:] = False
        
        # Base Game模式下重置Wild倍数和Mega系统，Free Game模式下保留累积
        if not keep_multipliers:
            # Base Game: 重置所有累积状态
            self.wild_eliminate_count = 0
            self.mega_level = 0
            self.mega_eliminate_count = 0
        # Free Game: 保留 wild_eliminate_count, mega_level, mega_eliminate_count 跨spin累积
        
        # 恢复中央Wild符号的固定状态
        self.board[CENTER_ROW, CENTER_COL] = WILD_SYMBOL
        self.fixed_mask[CENTER_ROW, CENTER_COL] = True
        self.fixed_cells.add((CENTER_ROW, CENTER_COL))
        
        cascade_count, total_removed, round_score, details = self.process_cascades()
        self.score += round_score
        
        return cascade_count, total_removed, round_score, details
    
    def try_eliminate_feature(self):
        """尝试触发Mega Eliminate特色（新系统）
        
        新规则：
        - 只有当无法消除时才检查
        - 根据 mega_eliminate_count 放置对应数量的钻石形状
        - 所有钻石形状使用同一符号（只抽选一次）
        - 抽选符号使用 Base Eliminate Symbol
        - 使用智能位置筛选而非随机尝试
        """
        # 检查是否有 mega_eliminate_count
        if self.mega_eliminate_count <= 0:
            return False
        
        # 检查 eliminate_symbol 是否有效
        if self.eliminate_symbol is None or len(self.eliminate_symbol) == 0 or np.sum(self.eliminate_symbol) == 0:
            print("警告：eliminate_symbol无效，跳过mega符号放置")
            self.mega_eliminate_count = 0
            self.mega_level = 0
            return False
        
        # 记录触发判断
        self.eliminate_trigger_count += 1
        
        # 使用 mega_eliminate_count 作为放置数量
        num_blocks = self.mega_eliminate_count
        
        # 只抽选一次符号，所有mega symbol使用同一符号
        try:
            mega_symbol_id = weighted_choice_numba(self.eliminate_symbol)
        except Exception as e:
            print(f"错误：无法选择mega符号")
            print(f"eliminate_symbol 类型: {type(self.eliminate_symbol)}")
            print(f"eliminate_symbol 内容: {self.eliminate_symbol}")
            print(f"eliminate_symbol 总和: {np.sum(self.eliminate_symbol) if self.eliminate_symbol is not None else 'None'}")
            print(f"错误信息: {e}")
            # 重置并返回
            self.mega_eliminate_count = 0
            self.mega_level = 0
            return False
        
        # 定义所有理论上可放置的中心点位置（钻石形状不超出边界且不包含Wild）
        # 钻石形状定义：[r,c], [r,c-2], [r+1,c-1], [r+1,c+1]
        # 检查规则：不能包含Wild[3,6]，4格必须都在有效位置内
        all_possible_centers = [
            # Row 0: 有效列 [3,5,7,9], 钻石需要c-2, c, c-1, c+1都有效，下行是row1:[2,4,6,8,10]
            (0, 5), (0, 7), (0, 9),
            # Row 1: 有效列 [2,4,6,8,10], 下行是row2:[1,3,5,7,9,11]
            (1, 4), (1, 6), (1, 8), (1, 10),
            # Row 2: 有效列 [1,3,5,7,9,11], 下行是row3:[0,2,4,6,8,10,12]
            # 排除 (2,5),(2,7) 因为会包含Wild[3,6]
            (2, 3), (2, 9), (2, 11),
            # Row 3: 有效列 [0,2,4,6,8,10,12], 下行是row4:[1,3,5,7,9,11]
            # 排除 (3,6) 因为本身是Wild, 排除 (3,8) 因为会包含Wild[3,6]
            (3, 2), (3, 4), (3, 10), (3, 12),
            # Row 4: 有效列 [1,3,5,7,9,11], 下行是row5:[2,4,6,8,10]
            (4, 3), (4, 5), (4, 7), (4, 9), (4, 11),
            # Row 5: 有效列 [2,4,6,8,10], 下行是row6:[3,5,7,9]
            # (5,10) 的钻石是: [5,10],[5,8],[6,9],[6,11]，但row6只有[3,5,7,9]，所以[6,11]无效
            (5, 4), (5, 6), (5, 8)
        ]
        
        placed_blocks = 0
        occupied_cells = set(self.fixed_cells)
        
        for _ in range(num_blocks):
            # 筛选当前可放置的位置
            valid_centers = []
            
            for center_row, center_col in all_possible_centers:
                # 计算钻石形状的4格
                block_cells = [
                    (center_row, center_col),
                    (center_row, center_col - 2),
                    (center_row + 1, center_col - 1),
                    (center_row + 1, center_col + 1)
                ]
                
                # 检查所有4格是否都有效
                if not all(is_valid_hex_cell(r, c) and 0 <= r < self.rows and 0 <= c < self.cols 
                          for r, c in block_cells):
                    continue
                
                # 限制1: 不能覆盖中央Wild位置
                # 任何一个格子是Wild[3,6]，该中心点就不可用
                if any(r == CENTER_ROW and c == CENTER_COL for r, c in block_cells):
                    continue
                
                # 限制2: 不能互相覆盖（occupied_cells包含所有已固定的格子）
                # 任何一个格子被占用，该中心点就不可用
                if any(cell in occupied_cells for cell in block_cells):
                    continue
                
                # 注意：可以覆盖C1，C1会在消除后重新出现
                
                # 第一个块需要检查是否与现有符号相邻
                if placed_blocks == 0:
                    has_adjacent = False
                    for r, c in block_cells:
                        neighbors = get_hex_neighbors(r, c)
                        for i in range(6):
                            nr, nc = neighbors[i, 0], neighbors[i, 1]
                            if (0 <= nr < self.rows and 0 <= nc < self.cols and
                                is_valid_hex_cell(nr, nc) and
                                (nr, nc) not in block_cells and
                                self.board[nr, nc] == mega_symbol_id):
                                has_adjacent = True
                                break
                        if has_adjacent:
                            break
                    
                    if not has_adjacent:
                        continue
                
                # 这个中心点可用
                valid_centers.append((center_row, center_col, block_cells))
            
            # 如果没有可放置的位置，停止放置
            if len(valid_centers) == 0:
                # 防呆机制：还有mega符号要放置但已无位置可放
                if placed_blocks < num_blocks:
                    raise MegaPlacementImpossibleError(
                        f"无法放置所有mega符号！需要放置{num_blocks}个，只成功放置了{placed_blocks}个。"
                    )
                break
            
            # 从可放置位置中随机选择一个
            selected_idx = random.randint(0, len(valid_centers) - 1)
            center_row, center_col, block_cells = valid_centers[selected_idx]
            
            # 放置4格钻石形状（如果是C1则跳过，保持C1不变）
            for r, c in block_cells:
                if self.board[r, c] == 1:  # 如果是C1，跳过不修改
                    continue
                
                self.board[r, c] = mega_symbol_id
                occupied_cells.add((r, c))
                self.fixed_cells.add((r, c))
                self.fixed_mask[r, c] = True
            
            placed_blocks += 1
        
        # 记录结果并重置 mega_eliminate_count
        # 防呆机制：检查是否成功放置了所有required的mega符号
        if placed_blocks < num_blocks:
            raise MegaPlacementImpossibleError(
                f"无法放置所有mega符号！需要放置{num_blocks}个，只成功放置了{placed_blocks}个。"
            )
        
        if placed_blocks > 0:
            self.eliminate_success_count += 1
            self.mega_eliminate_count = 0  # 成功放置后重置，可以重新累积
            self.mega_level = 0  # 同时重置mega等级
        else:
            self.eliminate_fail_count += 1
            self.mega_eliminate_count = 0  # 失败也清空计数
            self.mega_level = 0
        
        return placed_blocks > 0

# ==================== 主函数 ====================

def basegame(rounds):
    """
    运行指定次数的基础游戏（numba优化版）
    rounds: 游戏轮数
    返回: (分数列表, C1数量列表, 初始C1数量列表, Wild倍数列表)
    """
    scores = np.zeros(rounds, dtype=np.int64)
    c1_counts = np.zeros(rounds, dtype=np.int32)
    initial_c1_counts = np.zeros(rounds, dtype=np.int32)  # 初始版面C1数量
    wild_multipliers = np.zeros(rounds, dtype=np.int32)   # 每轮结束时的Wild倍数计数
    
    # 预先创建一个游戏实例来触发numba编译
    if rounds > 0:
        print("预热numba编译...")
        warmup_game = Game7x7()
        warmup_game.initialize_board()
        warmup_game.play_round()
        print("编译完成，开始模拟...\n")
    
    # 创建一个可重用的游戏实例，避免重复初始化
    game = Game7x7()
    
    # 初始化统计变量
    total_trigger_count = 0
    total_success_count = 0
    total_fail_count = 0
    games_with_eliminate = []  # 触发2×2的游戏得分
    games_without_eliminate = []  # 未触发2×2的游戏得分
    
    for i in range(rounds):
        # 使用循环重试机制，防止mega符号无法放置
        retry_count = 0
        max_retries = 100  # 最多重试100次
        
        while retry_count < max_retries:
            try:
                # 重置游戏状态
                game.board[:] = 0
                game.fixed_mask[:] = False
                game.fixed_cells.clear()
                game.score = 0
                game.eliminate_count = 0
                game.eliminate_trigger_count = 0
                game.eliminate_success_count = 0
                game.eliminate_fail_count = 0
                game.score_before_eliminate = 0
                game.score_from_eliminate = 0
                
                # 每轮重新选择参数集（保持随机性）
                game.reel_set = game.select_reel_by_weight()
                game.drop_set = game.select_drop_by_weight(eliminate_count=0)
                game.load_reel_data()
                game.load_drop_data()
                
                # 初始化并游戏
                game.initialize_board()
                initial_c1_counts[i] = np.sum(game.board == 1)  # 记录初始版面C1数量
                cascade, removed, score, details = game.play_round()
                
                # 成功完成，跳出重试循环
                break
                
            except MegaPlacementImpossibleError as e:
                retry_count += 1
                if retry_count >= max_retries:
                    print(f"警告：第{i+1}轮在{max_retries}次重试后仍无法放置mega符号，跳过此轮")
                    score = 0
                    cascade = 0
                    break
                # 否则继续重试
        
        scores[i] = score
        c1_counts[i] = np.sum(game.board == 1)  # 记录消除结束后C1数量
        wild_multipliers[i] = game.wild_eliminate_count  # 记录Wild倍数计数
        
        # 累积统计
        total_trigger_count += game.eliminate_trigger_count
        total_success_count += game.eliminate_success_count
        total_fail_count += game.eliminate_fail_count
        
        # 分类统计
        if game.eliminate_success_count > 0:
            games_with_eliminate.append({
                'total_score': score,
                'score_before': game.score_before_eliminate,
                'score_after': score - game.score_before_eliminate
            })
        else:
            games_without_eliminate.append(score)
        
        # 显示进度
        if rounds >= 1000 and (i + 1) % 1000 == 0:
            print(f"完成 {i + 1}/{rounds} 轮...")
    
    # 输出2×2统计
    print("\n=== 2×2 Eliminate Feature 统计 ===")
    print(f"触发判断次数: {total_trigger_count}")
    print(f"成功放置次数: {total_success_count}")
    print(f"放置失败次数: {total_fail_count}")
    if total_trigger_count > 0:
        fail_rate = (total_fail_count / total_trigger_count) * 100
        print(f"失败率: {fail_rate:.2f}%")
        print(f"平均每轮触发: {total_trigger_count / rounds:.2f} 次")
    
    print("\n--- 分类统计 ---")
    print(f"触发2×2的游戏数: {len(games_with_eliminate)}")
    print(f"未触发2×2的游戏数: {len(games_without_eliminate)}")
    
    if games_with_eliminate:
        avg_total_with = np.mean([g['total_score'] for g in games_with_eliminate])
        avg_before = np.mean([g['score_before'] for g in games_with_eliminate])
        avg_after = np.mean([g['score_after'] for g in games_with_eliminate])
        print(f"\n触发2×2的游戏:")
        print(f"  平均总得分: {avg_total_with:.2f}")
        print(f"  平均触发前得分: {avg_before:.2f}")
        print(f"  平均2×2后增加: {avg_after:.2f}")
    
    if games_without_eliminate:
        avg_without = np.mean(games_without_eliminate)
        print(f"\n未触发2×2的游戏:")
        print(f"  平均得分: {avg_without:.2f}")
    
    if games_with_eliminate and games_without_eliminate:
        avg_total_with = np.mean([g['total_score'] for g in games_with_eliminate])
        avg_without = np.mean(games_without_eliminate)
        diff = avg_without - avg_total_with
        print(f"\n差异: 未触发比触发高 {diff:.2f} 分")
    
    # Wild倍数统计
    print("\n=== Wild倍数统计 ===")
    non_zero_wilds = wild_multipliers[wild_multipliers > 0]
    print(f"触发Wild倍数的轮数: {len(non_zero_wilds)} / {rounds} ({len(non_zero_wilds)/rounds*100:.2f}%)")
    if len(non_zero_wilds) > 0:
        print(f"Wild倍数计数统计:")
        print(f"  平均: {np.mean(non_zero_wilds):.2f}")
        print(f"  最小: {np.min(non_zero_wilds)}")
        print(f"  最大: {np.max(non_zero_wilds)}")
        print(f"  中位数: {np.median(non_zero_wilds):.2f}")
        
        # 倍数分布
        print(f"\nWild倍数分布:")
        for i in range(1, max(6, int(np.max(non_zero_wilds))+1)):
            count = np.sum(wild_multipliers == i)
            if count > 0:
                actual_mult = 1 if i <= 1 else (2 if i == 2 else min(2 + (i-2)*2, 1000))
                print(f"  计数{i} (倍数{actual_mult}x): {count} 次 ({count/rounds*100:.2f}%)")
    
    print("=" * 40)
    
    return scores, c1_counts, initial_c1_counts, wild_multipliers

def freegame(initial_spins, rounds):
    """
    运行指定次数的Free Game模拟（numba优化版）
    
    Args:
        initial_spins: 每场Free Game的初始spin次数
        rounds: 模拟的Free Game场次
    
    Returns:
        (total_scores, total_spins, wild_multipliers): 
            - total_scores: 每场Free Game的总得分数组
            - total_spins: 每场Free Game的总spin数数组
            - wild_multipliers: 每场Free Game结束时的Wild倍数计数
    
    Free Game规则:
        - 乘倍在整场Free Game期间累积保留
        - 每次spin结束检查C1数量，获得额外spin:
          * 3个C1: +10次spin
          * 4个C1: +12次spin
          * 5个C1: +15次spin
          * 6个C1: +20次spin
          * 7个C1: +30次spin
    """
    total_scores = np.zeros(rounds, dtype=np.int64)
    total_spins = np.zeros(rounds, dtype=np.int32)
    wild_multipliers = np.zeros(rounds, dtype=np.int32)  # 每场结束时的Wild倍数计数
    
    # 预热numba编译
    if rounds > 0:
        print("预热numba编译（Free Game模式）...")
        warmup_game = Game7x7(is_free_game=True)
        warmup_game.initialize_board()
        warmup_game.play_round(keep_multipliers=True)
        print("编译完成，开始Free Game模拟...\n")
    
    # Retrigger规则: C1数量 -> 额外spin数
    retrigger_map = {3: 10, 4: 12, 5: 15, 6: 20, 7: 30}
    
    for round_idx in range(rounds):
        # 创建Free Game实例
        game = Game7x7(is_free_game=True)
        
        remaining_spins = initial_spins
        total_score = 0
        spin_count = 0
        
        while remaining_spins > 0:
            # 使用重试机制防止mega符号无法放置
            retry_count = 0
            max_retries = 100
            
            while retry_count < max_retries:
                try:
                    # 重置游戏状态
                    game.board[:] = 0
                    game.fixed_mask[:] = False
                    game.fixed_cells.clear()
                    game.eliminate_count = 0
                    
                    # 每次spin重新选择参数集
                    game.reel_set = game.select_reel_by_weight()
                    game.drop_set = game.select_drop_by_weight(eliminate_count=0)
                    game.load_reel_data()
                    game.load_drop_data()
                    
                    # 初始化版面并游戏
                    game.initialize_board()
                    cascade, removed, score, details = game.play_round(keep_multipliers=True)
                    
                    # 成功完成，跳出重试循环
                    break
                    
                except MegaPlacementImpossibleError as e:
                    retry_count += 1
                    if retry_count >= max_retries:
                        print(f"警告：Free Game第{round_idx+1}场第{spin_count+1}次spin在{max_retries}次重试后仍无法放置mega符号，跳过此spin")
                        score = 0
                        cascade = 0
                        break
                    # 否则继续重试
            
            total_score += score
            spin_count += 1
            remaining_spins -= 1
            
            # 检查C1数量，判断是否retrigger
            c1_count = int(np.sum(game.board == 1))
            if c1_count in retrigger_map:
                extra_spins = retrigger_map[c1_count]
                remaining_spins += extra_spins
        
        total_scores[round_idx] = total_score
        total_spins[round_idx] = spin_count
        wild_multipliers[round_idx] = game.wild_eliminate_count  # 记录Free Game结束时的Wild倍数计数
        
        # 显示进度
        if rounds >= 100 and (round_idx + 1) % 100 == 0:
            print(f"完成 {round_idx + 1}/{rounds} 场Free Game...")
    
    # Wild倍数统计
    print("\n=== Free Game Wild倍数统计 ===")
    print(f"总场次: {rounds}")
    if len(wild_multipliers) > 0:
        print(f"Wild倍数计数统计:")
        print(f"  平均: {np.mean(wild_multipliers):.2f}")
        print(f"  最小: {np.min(wild_multipliers)}")
        print(f"  最大: {np.max(wild_multipliers)}")
        print(f"  中位数: {np.median(wild_multipliers):.2f}")
        
        # 倍数分布
        print(f"\nWild倍数分布:")
        max_count = int(np.max(wild_multipliers))
        for i in range(0, max_count + 1):
            count = np.sum(wild_multipliers == i)
            if count > 0:
                if i == 0:
                    print(f"  计数0 (倍数1x): {count} 次 ({count/rounds*100:.2f}%)")
                else:
                    actual_mult = 1 if i <= 1 else (2 if i == 2 else min(2 + (i-2)*2, 1000))
                    print(f"  计数{i} (倍数{actual_mult}x): {count} 次 ({count/rounds*100:.2f}%)")
    
    print("=" * 40)
    
    return total_scores, total_spins, wild_multipliers
# %%
