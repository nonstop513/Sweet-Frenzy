// engine-worker.js - 后台计算Worker
// 这个文件在独立的线程中运行，不阻塞UI

// 导入游戏数据和引擎代码
importScripts('data.js', 'engine.js');

// 确保使用正确的变量名（data.js导出的是data）
const gameData = typeof data !== 'undefined' ? data : self.gameData;

console.log('🔧 Worker启动成功');

// 监听主线程发来的消息
self.onmessage = function(e) {
    const { type, spins, wildCount, megaLevel, megaCount, isFreeGame, bet } = e.data;
    
    console.log(`📨 Worker收到任务: ${type}`);
    
    try {
        if (type === 'generateFreeGame') {
            // ===== 生成完整FreeGame脚本 =====
            const startTime = performance.now();
            
            const engine = new GameEngine(gameData);
            const script = engine.generateFreeGameScript(spins || 10, wildCount || 0);
            
            const duration = Math.round(performance.now() - startTime);
            console.log(`✅ FreeGame生成完成: ${duration}ms, 共${script.spins.length}个spin`);
            
            // 发送结果回主线程
            self.postMessage({
                type: 'freeGameComplete',
                script: script,
                duration: duration
            });
            
        } else if (type === 'generateSpin') {
            // ===== 生成单个Spin脚本 =====
            const startTime = performance.now();
            
            const engine = new GameEngine(gameData);
            const script = engine.generateSpinScript(
                megaLevel || 0,
                megaCount || 0,
                isFreeGame || false,
                wildCount || 0,
                bet || 1,
                true  // enableRedraw
            );
            
            const duration = Math.round(performance.now() - startTime);
            console.log(`✅ Spin生成完成: ${duration}ms, 分数${script.totalScore}`);
            
            self.postMessage({
                type: 'spinComplete',
                script: script,
                duration: duration
            });
            
        } else if (type === 'generateFreeGameWithProgress') {
            // ===== 生成FreeGame并报告进度 =====
            const engine = new GameEngine(gameData);
            const totalSpins = spins || 10;
            
            let remainingSpins = totalSpins;
            let currentWildCount = wildCount || 0;
            let currentMegaLevel = 0;
            let currentMegaCount = 0;
            
            const spinScripts = [];
            let completedSpins = 0;
            
            // 逐个生成spin并报告进度
            while (remainingSpins > 0) {
                const spinScript = engine.generateSpinScript(
                    currentMegaLevel, 
                    currentMegaCount, 
                    true, 
                    currentWildCount
                );
                
                spinScripts.push(spinScript);
                completedSpins++;
                
                // 发送进度更新
                self.postMessage({
                    type: 'progress',
                    current: completedSpins,
                    total: totalSpins,
                    percent: Math.round(completedSpins / totalSpins * 100)
                });
                
                // 更新状态
                currentWildCount = spinScript.wildEliminateCount;
                currentMegaLevel = spinScript.megaLevel;
                currentMegaCount = spinScript.megaEliminateCount;
                
                remainingSpins--;
            }
            
            // 组装完整脚本
            const freeGameScript = {
                isFreeGame: true,
                initialSpins: totalSpins,
                totalSpins: completedSpins,
                totalScore: spinScripts.reduce((sum, s) => sum + s.totalScore, 0),
                spins: spinScripts,
                startWildCount: wildCount || 0,
                endWildCount: currentWildCount,
                totalRetriggers: 0
            };
            
            console.log(`✅ FreeGame生成完成(带进度): 共${completedSpins}个spin`);
            
            self.postMessage({
                type: 'freeGameComplete',
                script: freeGameScript
            });
            
        } else {
            console.warn(`⚠️ 未知的任务类型: ${type}`);
        }
        
    } catch (error) {
        console.error('❌ Worker执行错误:', error);
        
        // 发送错误信息回主线程
        self.postMessage({
            type: 'error',
            error: {
                message: error.message,
                stack: error.stack
            }
        });
    }
};

// 错误处理
self.onerror = function(error) {
    console.error('❌ Worker全局错误:', error);
    
    self.postMessage({
        type: 'error',
        error: {
            message: error.message,
            filename: error.filename,
            lineno: error.lineno
        }
    });
};

console.log('🎯 Worker就绪，等待任务...');
