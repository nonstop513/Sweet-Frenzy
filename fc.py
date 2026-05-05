#%%
import xlwings as xw
import json

excel_path = r'D:\IGame\瘋狂果醬罐\H026(果醬罐).xlsx'
js_path = r'D:\IGame\瘋狂果醬罐\data.js'
js_path1 = r'D:\IGame\瘋狂果醬罐\demo\data.js'
def extract_range(sheet, range_str, key_name):
    """抓取指定范围的数据并转置"""
    val = sheet.range(range_str).value
    if not isinstance(val[0], list):
        val = [val]
    val = [list(col) for col in zip(*val)]
    
    # 如果转置后每个元素都是单元素列表，则展平为一维向量
    if all(isinstance(col, list) and len(col) == 1 for col in val):
        val = [col[0] for col in val]
    
    return {key_name: val}

def extract_range_no_transpose(sheet, range_str, key_name):
    """抓取指定范围的数据，不转置"""
    val = sheet.range(range_str).value
    if not isinstance(val, list):
        val = [val]
    elif not isinstance(val[0], list):
        val = [val]
    return {key_name: val}

app = xw.App(visible=False)
wb = app.books.open(excel_path)

output = {}

# Overview sheet
sht1 = wb.sheets['Overview']
output.update(extract_range_no_transpose(sht1, 'B36:K42', 'linkpoint'))
# BaseGameSymbol sheet
sht2 = wb.sheets['BaseGameSymbol']
# Symbol 1-5
output.update(extract_range(sht2, 'U4:AA123', 'baseGameSymbol1'))
output.update(extract_range(sht2, 'AC4:AI123', 'baseGameSymbolWeight1'))
output.update(extract_range(sht2, 'B19:D27', 'baseGameMY1'))

output.update(extract_range(sht2, 'BE4:BK123', 'baseGameSymbol2'))
output.update(extract_range(sht2, 'BM4:BS123', 'baseGameSymbolWeight2'))
output.update(extract_range(sht2, 'AL19:AN27', 'baseGameMY2'))

output.update(extract_range(sht2, 'CO4:CU123', 'baseGameSymbol3'))
output.update(extract_range(sht2, 'CW4:DC123', 'baseGameSymbolWeight3'))
output.update(extract_range(sht2, 'BV19:BX27', 'baseGameMY3'))

output.update(extract_range(sht2, 'DY4:EE123', 'baseGameSymbol4'))
output.update(extract_range(sht2, 'EG4:EM123', 'baseGameSymbolWeight4'))
output.update(extract_range(sht2, 'DF19:DH27', 'baseGameMY4'))

output.update(extract_range(sht2, 'FI4:FO123', 'baseGameSymbol5'))
output.update(extract_range(sht2, 'FQ4:FW123', 'baseGameSymbolWeight5'))
output.update(extract_range(sht2, 'EP19:ER27', 'baseGameMY5'))

# BaseGameSymbolDrop sheet
sht3 = wb.sheets['BaseGameSymbolDrop']
# Drop 1-5
output.update(extract_range(sht3, 'U4:AA28', 'BaseGameDrop1'))
output.update(extract_range(sht3, 'AC4:AI28', 'BaseGameDropRWeight1'))
output.update(extract_range(sht3, 'AK4:AK28', 'BaseGameDropPWeight1'))
output.update(extract_range(sht3, 'C19:C20', 'BaseGameDropmethod1'))
output.update(extract_range(sht3, 'G19:I27', 'BaseGameDropMy1'))

output.update(extract_range(sht3, 'BG4:BM28', 'BaseGameDrop2'))
output.update(extract_range(sht3, 'BO4:BU28', 'BaseGameDropRWeight2'))
output.update(extract_range(sht3, 'BW4:BW28', 'BaseGameDropPWeight2'))
output.update(extract_range(sht3, 'AO19:AO20', 'BaseGameDropmethod2'))
output.update(extract_range(sht3, 'AS19:AU27', 'BaseGameDropMy2'))

output.update(extract_range(sht3, 'CS4:CY28', 'BaseGameDrop3'))
output.update(extract_range(sht3, 'DA4:DG28', 'BaseGameDropRWeight3'))
output.update(extract_range(sht3, 'DI4:DI28', 'BaseGameDropPWeight3'))
output.update(extract_range(sht3, 'CA19:CA20', 'BaseGameDropmethod3'))
output.update(extract_range(sht3, 'CE19:CG27', 'BaseGameDropMy3'))

output.update(extract_range(sht3, 'EE4:EK28', 'BaseGameDrop4'))
output.update(extract_range(sht3, 'EM4:ES28', 'BaseGameDropRWeight4'))
output.update(extract_range(sht3, 'EU4:EU28', 'BaseGameDropPWeight4'))
output.update(extract_range(sht3, 'DM19:DM20', 'BaseGameDropmethod4'))
output.update(extract_range(sht3, 'DQ19:DS27', 'BaseGameDropMy4'))

output.update(extract_range(sht3, 'FQ4:FW28', 'BaseGameDrop5'))
output.update(extract_range(sht3, 'FY4:GE28', 'BaseGameDropRWeight5'))
output.update(extract_range(sht3, 'GG4:GG28', 'BaseGameDropPWeight5'))
output.update(extract_range(sht3, 'EY19:EY20', 'BaseGameDropmethod5'))
output.update(extract_range(sht3, 'FC19:FE27', 'BaseGameDropMy5'))

output.update(extract_range(sht3, 'HC4:HI28', 'BaseGameDrop6'))
output.update(extract_range(sht3, 'HK4:HQ28', 'BaseGameDropRWeight6'))
output.update(extract_range(sht3, 'HS4:HS28', 'BaseGameDropPWeight6'))
output.update(extract_range(sht3, 'GK19:GK20', 'BaseGameDropmethod6'))
output.update(extract_range(sht3, 'GO19:GQ27', 'BaseGameDropMy6'))

sht4 = wb.sheets['Description']

output.update(extract_range(sht4, 'D5:D9', 'ReelWeight'))
output.update(extract_range(sht4, 'D18:M23', 'DropWeight'))
output.update(extract_range(sht4, 'D37:D45', 'Eliminate'))
output.update(extract_range(sht4, 'G5:G9', 'FreeReelWeight'))
output.update(extract_range(sht4, 'P18:Y23', 'FreeDropWeight'))
output.update(extract_range(sht4, 'H37:H45', 'FreeEliminate'))

sht5 = wb.sheets['FreeGameSymbol']
output.update(extract_range(sht5, 'U4:AA123', 'FreeGameSymbol1'))
output.update(extract_range(sht5, 'AC4:AI123', 'FreeGameSymbolWeight1'))
output.update(extract_range(sht5, 'B19:D27', 'FreeGameMY1'))

output.update(extract_range(sht5, 'BE4:BK123', 'FreeGameSymbol2'))
output.update(extract_range(sht5, 'BM4:BS123', 'FreeGameSymbolWeight2'))
output.update(extract_range(sht5, 'AL19:AN27', 'FreeGameMY2'))

output.update(extract_range(sht5, 'CO4:CU123', 'FreeGameSymbol3'))
output.update(extract_range(sht5, 'CW4:DC123', 'FreeGameSymbolWeight3'))
output.update(extract_range(sht5, 'BV19:BX27', 'FreeGameMY3'))

output.update(extract_range(sht5, 'DY4:EE123', 'FreeGameSymbol4'))
output.update(extract_range(sht5, 'EG4:EM123', 'FreeGameSymbolWeight4'))
output.update(extract_range(sht5, 'DF19:DH27', 'FreeGameMY4'))

output.update(extract_range(sht5, 'FI4:FO123', 'FreeGameSymbol5'))
output.update(extract_range(sht5, 'FQ4:FW123', 'FreeGameSymbolWeight5'))
output.update(extract_range(sht5, 'EP19:ER27', 'FreeGameMY5'))

sht6 = wb.sheets['FreeGameSymbolDrop']
# Drop 1-5
output.update(extract_range(sht6, 'U4:AA28', 'FreeGameDrop1'))
output.update(extract_range(sht6, 'AC4:AI28', 'FreeGameDropRWeight1'))
output.update(extract_range(sht6, 'AK4:AK28', 'FreeGameDropPWeight1'))
output.update(extract_range(sht6, 'C19:C20', 'FreeGameDropmethod1'))
output.update(extract_range(sht6, 'G19:I27', 'FreeGameDropMy1'))

output.update(extract_range(sht6, 'BG4:BM28', 'FreeGameDrop2'))
output.update(extract_range(sht6, 'BO4:BU28', 'FreeGameDropRWeight2'))
output.update(extract_range(sht6, 'BW4:BW28', 'FreeGameDropPWeight2'))
output.update(extract_range(sht6, 'AO19:AO20', 'FreeGameDropmethod2'))
output.update(extract_range(sht6, 'AS19:AU27', 'FreeGameDropMy2'))

output.update(extract_range(sht6, 'CS4:CY28', 'FreeGameDrop3'))
output.update(extract_range(sht6, 'DA4:DG28', 'FreeGameDropRWeight3'))
output.update(extract_range(sht6, 'DI4:DI28', 'FreeGameDropPWeight3'))
output.update(extract_range(sht6, 'CA19:CA20', 'FreeGameDropmethod3'))
output.update(extract_range(sht6, 'CE19:CG27', 'FreeGameDropMy3'))

output.update(extract_range(sht6, 'EE4:EK28', 'FreeGameDrop4'))
output.update(extract_range(sht6, 'EM4:ES28', 'FreeGameDropRWeight4'))
output.update(extract_range(sht6, 'EU4:EU28', 'FreeGameDropPWeight4'))
output.update(extract_range(sht6, 'DM19:DM20', 'FreeGameDropmethod4'))
output.update(extract_range(sht6, 'DQ19:DS27', 'FreeGameDropMy4'))

output.update(extract_range(sht6, 'FQ4:FW28', 'FreeGameDrop5'))
output.update(extract_range(sht6, 'FY4:GE28', 'FreeGameDropRWeight5'))
output.update(extract_range(sht6, 'GG4:GG28', 'FreeGameDropPWeight5'))
output.update(extract_range(sht6, 'EY19:EY20', 'FreeGameDropmethod5'))
output.update(extract_range(sht6, 'FC19:FE27', 'FreeGameDropMy5'))

output.update(extract_range(sht6, 'HC4:HI28', 'FreeGameDrop6'))
output.update(extract_range(sht6, 'HK4:HQ28', 'FreeGameDropRWeight6'))
output.update(extract_range(sht6, 'HS4:HS28', 'FreeGameDropPWeight6'))
output.update(extract_range(sht6, 'GK19:GK20', 'FreeGameDropmethod6'))
output.update(extract_range(sht6, 'GO19:GQ27', 'FreeGameDropMy6'))

sht7 = wb.sheets['工作表1']
output.update(extract_range(sht7, 'B1:B58', 'baseredraw'))
output.update(extract_range(sht7, 'C1:C58', 'freeredraw'))
output.update(extract_range(sht7, 'A1:A57', 'multipleRange'))


wb.close()
app.quit()

# 将数据写入 data.js
with open(js_path, 'w', encoding='utf-8') as f:
    f.write('const data = ')
    json.dump(output, f, indent=2, ensure_ascii=False)
    f.write(';')
with open(js_path1, 'w', encoding='utf-8') as f:
    f.write('const data = ')
    json.dump(output, f, indent=2, ensure_ascii=False)
    f.write(';')
print(f'数据已保存到 {js_path}')
# %%
