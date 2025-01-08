// 用户编辑状态
const userEdits = {
    selectedColor: null,
    editingCountry: null,
    countryEdits: {} // 存储用户编辑的国家信息
};

// 颜色映射
const colorMap = {
    red: '--user-red',
    orange: '--user-orange',
    yellow: '--user-yellow',
    green: '--user-green',
    cyan: '--user-cyan',
    blue: '--user-blue',
    purple: '--user-purple'
};

// 显示编辑面板
function showEditPanel(countryId) {
    console.log('Showing edit panel for country:', countryId);
    
    const editPanel = document.getElementById('edit-panel');
    if (!editPanel) {
        console.error('Edit panel not found');
        return;
    }

    // 强制显示编辑面板
    editPanel.style.cssText = `
        display: block !important;
        position: fixed !important;
        right: 20px !important;
        top: 20px !important;
        z-index: 1000 !important;
        background: rgba(255, 255, 255, 0.95) !important;
        padding: 20px !important;
        border-radius: 10px !important;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.3) !important;
    `;
    
    console.log('Edit panel style after show:', editPanel.style.cssText);
}

// 选择颜色
function selectColor(color) {
    userEdits.selectedColor = color;
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.color === color) {
            option.classList.add('selected');
        }
    });
}

// 保存编辑
function saveEdit() {
    if (!userEdits.selectedColor || !userEdits.editingCountry) {
        alert('请选择一个颜色！');
        return;
    }
    
    // 保存编辑信息
    userEdits.countryEdits[userEdits.editingCountry] = {
        color: userEdits.selectedColor
    };
    
    // 更新国家颜色
    updateCountryColor(userEdits.editingCountry, userEdits.selectedColor);
    
    // 更新统计信息
    updateStats();
    
    // 关闭编辑面板
    closeEditPanel();
    
    // 保存到本地存储
    saveToLocalStorage();
}

// 更新国家颜色
function updateCountryColor(countryId, color) {
    if (window.scene) {
        window.scene.traverse((object) => {
            if (object.userData && object.userData.countryId === countryId) {
                const material = object.material;
                const colorValue = getComputedStyle(document.documentElement)
                    .getPropertyValue(colorMap[color]);
                material.color.setStyle(colorValue);
                material.opacity = 0.8;
                material.transparent = true;
            }
        });
    }
}

// 关闭编辑面板
function closeEditPanel() {
    const editPanel = document.getElementById('edit-panel');
    if (editPanel) {
        editPanel.style.display = 'none';
    }
    userEdits.editingCountry = null;
    userEdits.selectedColor = null;
}

// 保存到本地存储
function saveToLocalStorage() {
    localStorage.setItem('worldMapEdits', JSON.stringify(userEdits.countryEdits));
}

// 从本地存储加载
function loadFromLocalStorage() {
    const saved = localStorage.getItem('worldMapEdits');
    if (saved) {
        userEdits.countryEdits = JSON.parse(saved);
        // 恢复所有已保存的编辑
        Object.entries(userEdits.countryEdits).forEach(([countryId, edit]) => {
            updateCountryColor(countryId, edit.color);
        });
        updateStats();
    }
}

// 更新统计信息
function updateStats() {
    const statsPanel = document.getElementById('stats-panel');
    const userStats = document.getElementById('user-stats');
    const totalProgress = document.getElementById('total-progress');
    
    if (!statsPanel || !userStats || !totalProgress) return;

    // 清空现有统计
    userStats.innerHTML = '';
    
    // 统计每种颜色的数量
    const colorCounts = {};
    Object.values(userEdits.countryEdits).forEach(edit => {
        colorCounts[edit.color] = (colorCounts[edit.color] || 0) + 1;
    });
    
    // 显示每种颜色的统计
    Object.entries(colorCounts).forEach(([color, count]) => {
        const statDiv = document.createElement('div');
        statDiv.className = 'user-stat';
        statDiv.innerHTML = `
            <div class="user-color" style="background-color: var(${colorMap[color]})"></div>
            <span>${count} 个国家</span>
        `;
        userStats.appendChild(statDiv);
    });
    
    // 计算总进度
    const totalCountries = Object.keys(window.countryCodeMap || {}).length;
    const completedCountries = Object.keys(userEdits.countryEdits).length;
    const progress = totalCountries ? (completedCountries / totalCountries) * 100 : 0;
    
    totalProgress.style.width = `${progress}%`;
    
    // 显示统计面板
    statsPanel.style.display = 'block';
}

// 初始化事件监听器
function initializeEditEvents() {
    try {
        console.log('Initializing edit events...');
        
        // 获取所有需要的元素
        const elements = {
            editPanel: document.getElementById('edit-panel'),
            saveButton: document.getElementById('save-button'),
            cancelButton: document.getElementById('cancel-button'),
            colorOptions: document.querySelectorAll('.color-option')
        };

        // 打印元素状态以便调试
        console.log('Found elements:', {
            editPanel: !!elements.editPanel,
            saveButton: !!elements.saveButton,
            cancelButton: !!elements.cancelButton,
            colorOptionsCount: elements.colorOptions.length
        });

        // 检查必需的元素
        if (!elements.editPanel) {
            throw new Error('Edit panel not found');
        }

        // 添加事件监听器（只有在元素存在时才添加）
        if (elements.saveButton) {
            elements.saveButton.addEventListener('click', saveEdit);
        }
        
        if (elements.cancelButton) {
            elements.cancelButton.addEventListener('click', closeEditPanel);
        }
        
        if (elements.colorOptions.length > 0) {
            elements.colorOptions.forEach(option => {
                option.addEventListener('click', () => {
                    console.log('Color option clicked:', option.dataset.color);
                    selectColor(option.dataset.color);
                });
            });
        }

        // 定期自动保存
        setInterval(saveToLocalStorage, 30000);

        // 加载保存的编辑
        loadFromLocalStorage();
        
        console.log('Edit events initialized successfully');
        
        console.log('Edit panel initial display style:', document.getElementById('edit-panel').style.display);
        
    } catch (error) {
        console.error('Error initializing edit events:', error);
        // 显示用户友好的错误消息
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 10px;
            border-radius: 5px;
            z-index: 1000;
        `;
        errorMessage.textContent = `初始化错误: ${error.message}`;
        document.body.appendChild(errorMessage);
    }
}

// 确保在 DOM 完全加载后再初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEditEvents);
} else {
    initializeEditEvents();
}

// 将 showEditPanel 添加到全局作用域
window.showEditPanel = showEditPanel;
