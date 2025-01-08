import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TextureLoader } from 'three';
import countryCodeMap from './server/config/countryCodeMap.js';

// 从全局配置获取 API 配置
const API_BASE_URL = window.ENV.API_BASE_URL;

// 将函数添加到全局作用域
window.generateImage = async function(type) {
    const editPanel = document.getElementById('edit-panel');
    const countryId = editPanel.dataset.countryId;
    console.log('Generating image for country ID:', countryId);
    
    let alpha3Code = countryCodeMap[countryId];
    console.log('Initial alpha3Code lookup:', alpha3Code);
    
    // 如果没有找到映射，尝试直接使用countryId作为alpha3Code
    if (!alpha3Code && typeof countryId === 'string' && countryId.length === 3) {
        alpha3Code = countryId;
        console.log('Using countryId as alpha3Code:', alpha3Code);
    }
    
    // 如果还是没有找到，尝试从countries数据中查找
    if (!alpha3Code && countries) {
        const country = countries.features.find(f => {
            console.log('Checking country:', f.properties.name, 'ID:', f.id, 'ISO_A3:', f.properties.ISO_A3);
            return f.id === parseInt(countryId) || f.id === countryId || f.properties.ISO_A3 === countryId;
        });
        if (country) {
            alpha3Code = country.properties.ISO_A3;
            console.log('Found country in features:', country.properties.name, 'ISO_A3:', alpha3Code);
            // 更新映射表
            countryCodeMap[countryId] = alpha3Code;
            countryCodeMap[alpha3Code] = alpha3Code;
        }
    }

    const countryName = document.getElementById('edit-name').value;

    if (!countryName) {
        alert('请先输入国家名称！');
        return;
    }

    if (!alpha3Code) {
        console.error('无法找到国家代码，国家ID:', countryId);
        alert('无法找到该国家的代码，请确保选择了正确的国家');
        return;
    }
    
    const button = event.target;
    const imageSection = button.closest('.image-section');
    const preview = imageSection.querySelector('.preview');
    const description = imageSection.querySelector('.description');
    
    // 显示加载状态
    button.disabled = true;
    preview.innerHTML = '<div class="loading"></div>';
    
    try {
        // 构建提示词
        let prompt = '';
        if (type === 'currency') {
            prompt = `${countryName}货币的纸币图片`;
        } else if (type === 'animal') {
            prompt = `${countryName}的代表动物图片`;
        }

        console.log('Sending AI generation request for:', {countryName, alpha3Code, type, prompt});
        
        // 设置请求超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 50000); // 50秒超时
        
        // 调用AI生成接口
        const response = await fetch(`${API_BASE_URL}/ai/generate-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Connection': 'keep-alive'
            },
            body: JSON.stringify({
                countryName,
                countryCode: alpha3Code,
                type,
                prompt
            }),
            signal: controller.signal,
            // 添加缓存控制
            cache: 'no-store',
            // 启用跨域请求
            mode: 'cors',
            // 添加凭证
            credentials: 'same-origin'
        });
        
        clearTimeout(timeoutId);
        
        // 检查响应状态
        if (!response.ok) {
            let errorMessage = `生成失败 (${response.status})`;
            try {
                const errorText = await response.text();
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                } catch (e) {
                    console.error('Error parsing error response:', e);
                    errorMessage = errorText || errorMessage;
                }
            } catch (e) {
                console.error('Error reading error response:', e);
            }
            throw new Error(errorMessage);
        }
        
        // 读取响应数据
        let data;
        try {
            // 先获取响应文本
            const responseText = await response.text();
            console.log('Raw response text length:', responseText.length);
            console.log('Response text preview:', responseText.substring(0, 100) + '...');
            console.log('Response content type:', response.headers.get('content-type'));
            
            try {
                // 尝试解析JSON
                data = JSON.parse(responseText);
                console.log('Successfully parsed JSON data:', {
                    hasBase64: !!data.base64Data,
                    hasImageUrl: !!data.imageUrl,
                    dataKeys: Object.keys(data)
                });
            } catch (e) {
                console.error('Error parsing JSON:', e);
                // 检查是否是base64格式
                const isBase64 = /^[A-Za-z0-9+/=]+$/.test(responseText.trim());
                console.log('Is response base64 format:', isBase64);
                
                if (isBase64) {
                    data = { base64Data: responseText };
                    console.log('Treating response as base64 data');
                } else {
                    console.log('Response is neither JSON nor base64');
                    throw new Error('服务器返回的数据格式不正确');
                }
            }
        } catch (e) {
            console.error('Error reading response:', e);
            throw new Error('读取服务器响应失败');
        }
        
        console.log('AI generation successful, received data:', data);
        
        // 显示生成的图片
        if (data.base64Data) {
            const img = new Image();
            img.onload = function() {
                preview.innerHTML = '';
                preview.appendChild(img);
            };
            img.onerror = function() {
                img.src = `default-${type}.png`;
            };
            img.src = `data:image/jpeg;base64,${data.base64Data}`;
            preview.innerHTML = '<div class="loading">加载图片中...</div>';
        } else if (data.imageUrl) {
            const img = new Image();
            img.onload = function() {
                preview.innerHTML = '';
                preview.appendChild(img);
            };
            img.onerror = function() {
                img.src = `default-${type}.png`;
            };
            img.src = data.imageUrl;
            preview.innerHTML = '<div class="loading">加载图片中...</div>';
        } else {
            throw new Error('服务器返回的数据中没有图片');
        }
        
        // 更新描述
        if (data.description) {
            description.textContent = data.description;
        }
    } catch (error) {
        console.error('Error generating image:', error);
        let errorMessage = error.message;
        if (error.name === 'AbortError') {
            errorMessage = '请求超时，请重试';
        } else if (error instanceof TypeError && error.message === 'Failed to fetch') {
            errorMessage = '网络连接失败，请检查网络后重试';
        }
        preview.innerHTML = `<div class="error">${errorMessage}</div>`;
    } finally {
        button.disabled = false;
    }
};

// 修改保存函数以匹配数据结构
window.saveCountryData = async function() {
    const editPanel = document.getElementById('edit-panel');
    const countryId = editPanel.dataset.countryId;
    console.log('Saving data for country ID:', countryId);
    
    let alpha3Code = countryCodeMap[countryId];
    console.log('Initial alpha3Code lookup:', alpha3Code);
    
    if (!alpha3Code && typeof countryId === 'string' && countryId.length === 3) {
        alpha3Code = countryId;
        console.log('Using countryId as alpha3Code:', alpha3Code);
    }
    
    if (!alpha3Code && countries) {
        const country = countries.features.find(f => {
            console.log('Checking country:', f.properties.name, 'ID:', f.id, 'ISO_A3:', f.properties.ISO_A3);
            return f.id === parseInt(countryId) || f.id === countryId || f.properties.ISO_A3 === countryId;
        });
        if (country) {
            alpha3Code = country.properties.ISO_A3;
            console.log('Found country in features:', country.properties.name, 'ISO_A3:', alpha3Code);
            countryCodeMap[countryId] = alpha3Code;
            countryCodeMap[alpha3Code] = alpha3Code;
            if (typeof countryId === 'number') {
                countryCodeMap[countryId.toString()] = alpha3Code;
            }
        }
    }
    
    if (!alpha3Code) {
        console.error('无法找到国家代码，国家ID:', countryId);
        alert('无法找到该国家的代码，请确保选择了正确的国家');
        return;
    }

    const countryName = document.getElementById('edit-name').value;
    if (!countryName) {
        alert('请输入国家名称！');
        return;
    }
    
    // 构建完整的国家数据对象
    const countryData = {
        name: countryName,
        alpha3Code: alpha3Code,
        capital: document.getElementById('edit-capital').value,
        population: document.getElementById('edit-population').value,
        area: document.getElementById('edit-area').value,
        flag: {
            name: `${countryName}国旗`,
            description: `${countryName}国旗`,
            image: null
        },
        currency: {
            name: '',
            code: alpha3Code === 'CHN' ? 'CNY' : '',
            symbol: alpha3Code === 'CHN' ? '¥' : '',
            description: document.querySelector('.currency-description').textContent || `${countryName}的法定货币`,
            image: null
        },
        famousAnimal: {
            name: '',
            description: document.querySelector('.animal-description').textContent || `${countryName}的标志性动物`,
            image: null
        }
    };
    
    try {
        // 处理国旗图片
    const flagFile = document.getElementById('flag-upload').files[0];
    if (flagFile) {
        try {
            const base64Data = await fileToBase64(flagFile);
                countryData.flag.image = base64Data;
        } catch (error) {
            console.error('Error converting flag to base64:', error);
                alert('国旗图片处理失败，请重试');
            return;
        }
        } else {
            const flagImg = document.querySelector('.flag-preview img');
            if (flagImg && flagImg.src) {
                if (flagImg.src.startsWith('data:image')) {
                    // 如果是base64格式，去掉前缀
                    countryData.flag.image = flagImg.src.split(',')[1];
                } else if (flagImg.src.startsWith('http')) {
                    // 如果是URL，保持原样
                    countryData.flag.image = flagImg.src;
                }
            }
        }
        
        // 处理货币图片
        const currencyImg = document.querySelector('.currency-preview img');
        if (currencyImg && currencyImg.src) {
            if (currencyImg.src.startsWith('data:image')) {
                countryData.currency.image = currencyImg.src.split(',')[1];
            } else if (currencyImg.src.startsWith('http')) {
                countryData.currency.image = currencyImg.src;
            }
        }
        
        // 处理动物图片
        const animalImg = document.querySelector('.animal-preview img');
        if (animalImg && animalImg.src) {
            if (animalImg.src.startsWith('data:image')) {
                countryData.famousAnimal.image = animalImg.src.split(',')[1];
            } else if (animalImg.src.startsWith('http')) {
                countryData.famousAnimal.image = animalImg.src;
            }
        }

        // 保存数据前打印日志
        console.log('Saving country data with images:', {
            flagImage: countryData.flag.image ? countryData.flag.image.substring(0, 100) + '...' : null,
            currencyImage: countryData.currency.image ? countryData.currency.image.substring(0, 100) + '...' : null,
            animalImage: countryData.famousAnimal.image ? countryData.famousAnimal.image.substring(0, 100) + '...' : null
        });
        
        // 保存数据
        const response = await fetch(`${API_BASE_URL}/countries/${alpha3Code}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(countryData)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Save failed:', response.status, errorText);
            throw new Error('保存失败: ' + errorText);
        }
        
        const savedData = await response.json();
        console.log('Save successful, received data:', savedData);
        
        alert('保存成功！');
        editPanel.style.display = 'none';
        
        // 延迟一下再刷新显示，确保服务器数据已更新
        setTimeout(() => {
            showCountryInfo(countryId);
        }, 1000);
    } catch (error) {
        console.error('Error saving country data:', error);
        alert(error.message || '保存失败，请重试');
    }
};

// 修改文件转换为base64的函数
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // 确保返回的是纯base64字符串，去掉data:image前缀
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 辅助函数：将图片URL转换为base64
function imageUrlToBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = reject;
        img.src = url;
    });
}

window.cancelEdit = function() {
    if (confirm('确定要取消编辑吗？')) {
        document.getElementById('edit-panel').style.display = 'none';
    }
};

// 创建场景、相机和渲染器
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('map-container').appendChild(renderer.domElement);

// 设置相机位置
camera.position.z = 200;

// 添加轨道控制
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// 创建球形地图投影
const projection = d3.geoOrthographic()
    .scale(100)
    .translate([0, 0])
    .clipAngle(90);

// 加载纹理
const textureLoader = new TextureLoader();
const earthTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_atmos_2048.jpg');
const bumpTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg');
const specTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg');
const cloudTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png');

// 添加全局旋转控制变量
let isRotating = true;
let autoRotateSpeed = 0.0005;
let earthGroup, clouds; // 添加全局变量以存储对象引用

// 加载世界地图数据
let countries; // 添加全局变量
d3.json('https://unpkg.com/world-atlas@2/countries-110m.json').then(function(data) {
    countries = topojson.feature(data, data.objects.countries);
    
    // 初始化国家代码映射
    countries.features.forEach(country => {
        const id = country.id;
        const alpha3Code = country.properties.ISO_A3;
        const name = country.properties.name;
        // 同时使用数字ID和alpha3代码作为键
        if (id && alpha3Code) {
            // 存储数字ID到alpha3的映射
            countryCodeMap[id] = alpha3Code;
            // 存储字符串形式的ID到alpha3的映射
            countryCodeMap[id.toString()] = alpha3Code;
            // 存储alpha3到自身的映射
            countryCodeMap[alpha3Code] = alpha3Code;
            // 存储国家名称到alpha3的映射
            if (name) {
                countryCodeMap[name] = alpha3Code;
            }
            console.log(`Mapped country: ${name} (ID=${id}, ISO_A3=${alpha3Code})`);
        }
    });
    
    // 创建地球基础球体
    const sphereGeometry = new THREE.SphereGeometry(100, 64, 64);
    const sphereMaterial = new THREE.MeshPhongMaterial({
        map: earthTexture,
        bumpMap: bumpTexture,
        bumpScale: 0.8,
        specularMap: specTexture,
        specular: new THREE.Color('grey'),
        shininess: 5
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    
    // 创建一个组来包含所有内容
    earthGroup = new THREE.Group();
    
    // 创建一个组来包含所有边界线
    const boundariesGroup = new THREE.Group();
    
    // 创建国家边界和区域
    countries.features.forEach(function(country) {
        // 创建边界线
        const lineGeometry = new THREE.BufferGeometry();
        const lineCoordinates = [];
        
        // 创建区域网格
        const shapeGeometry = new THREE.BufferGeometry();
        const shapeCoordinates = [];
        
        // 处理多边形坐标
        const processCoordinates = (coords) => {
            coords.forEach(ring => {
                const points = [];
                for (let i = 0; i < ring.length; i++) {
                    const point = ring[i];
                    const lat = point[1] * Math.PI / 180;
                    const lon = -point[0] * Math.PI / 180;
                    const radius = 100;
                    
                    const x = radius * Math.cos(lat) * Math.cos(lon);
                    const y = radius * Math.sin(lat);
                    const z = radius * Math.cos(lat) * Math.sin(lon);
                    
                    points.push(new THREE.Vector3(x, y, z));
                    
                    // 添加到边界线坐标
                    if (i > 0) {
                        lineCoordinates.push(points[i-1].x, points[i-1].y, points[i-1].z);
                        lineCoordinates.push(x, y, z);
                    }
                }
                
                // 添加到区域坐标
                for (let i = 1; i < points.length - 1; i++) {
                    shapeCoordinates.push(points[0].x, points[0].y, points[0].z);
                    shapeCoordinates.push(points[i].x, points[i].y, points[i].z);
                    shapeCoordinates.push(points[i+1].x, points[i+1].y, points[i+1].z);
                }
            });
        };

        if (country.geometry.type === 'Polygon') {
            processCoordinates(country.geometry.coordinates);
        } else if (country.geometry.type === 'MultiPolygon') {
            country.geometry.coordinates.forEach(polygon => {
                processCoordinates(polygon);
            });
        }

        // 创建边界线
        lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lineCoordinates, 3));
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xFFFFFF,
            linewidth: 1,
            transparent: true,
            opacity: 0.5
        });
        const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
        
        // 创建区域网格
        shapeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(shapeCoordinates, 3));
        shapeGeometry.computeVertexNormals(); // 计算法线以便正确显示光照
        const shapeMaterial = new THREE.MeshPhongMaterial({
            color: 0x808080,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        const shape = new THREE.Mesh(shapeGeometry, shapeMaterial);
        
        // 修改存储国家ID的方式
        let countryId = country.id || country.properties.ISO_A3;
        
        // 使用原始 ID
        countryId = country.id || country.properties.ISO_A3;
        
        // 存储国家ID和名称
        lines.userData.countryId = countryId;
        lines.userData.countryName = country.properties.name;
        shape.userData.countryId = countryId;
        shape.userData.countryName = country.properties.name;
        
        // 将边界线和区域添加到边界组中
        boundariesGroup.add(lines);
        boundariesGroup.add(shape);
    });
    
    // 将地球和边界组添加到主组中
    earthGroup.add(sphere);
    earthGroup.add(boundariesGroup);
    
    // 将地球组添加到场景
    scene.add(earthGroup);

    // 创建云层
    const cloudGeometry = new THREE.SphereGeometry(101, 64, 64);
    const cloudMaterial = new THREE.MeshPhongMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0.4
    });
    clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
    scene.add(clouds);

    // 创建气层效果
    const atmosphereGeometry = new THREE.SphereGeometry(102, 64, 64);
    const atmosphereMaterial = new THREE.MeshPhongMaterial({
        color: 0x4B6B8C,
        transparent: true,
        opacity: 0.2,
        side: THREE.BackSide
    });
    const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(atmosphere);

    // 修改动画函数
    function animate() {
        requestAnimationFrame(animate);
        if (isRotating) {
            earthGroup.rotation.y += autoRotateSpeed;
            clouds.rotation.y += autoRotateSpeed + 0.0002;
        }
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
});

// 调整光源位置和强度
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0xffffff, 1.4);
pointLight.position.set(200, 200, 200);
scene.add(pointLight);

// 添加射线投射器用于检测点击
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// 添加全局变量
let selectedCountryId = null;

// 修改点击事件处理函数
function onMouseClick(event) {
    // 计算鼠标位置
    const mouse = new THREE.Vector2();
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 设置射线投射器
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // 检测相交的对象
    const intersects = raycaster.intersectObjects(earthGroup.children[1].children, true);
    
    if (intersects.length > 0) {
        const selectedObject = intersects[0].object;
        if (selectedObject.userData.countryId) {
            const countryId = selectedObject.userData.countryId;
            selectedCountryId = countryId;  // 保存选中的国家ID
            console.log('Clicked country:', countryId);
            
            // 暂停自动旋转
            isRotating = false;

            // 显示国家信息
            showCountryInfo(countryId);
        }
    }
}

// 添加事件监听器
renderer.domElement.addEventListener('click', onMouseClick);
renderer.domElement.addEventListener('touchstart', onTouchStart);
renderer.domElement.addEventListener('touchend', onTouchEnd);

let touchStartTime = 0;
let touchStartPosition = { x: 0, y: 0 };

function onTouchStart(event) {
    event.preventDefault();
    touchStartTime = Date.now();
    touchStartPosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
    };
}

function onTouchEnd(event) {
    event.preventDefault();
    const touchEndTime = Date.now();
    const touchEndPosition = {
        x: event.changedTouches[0].clientX,
        y: event.changedTouches[0].clientY
    };

    // 检查是否是点击而不是滑动
    const timeDiff = touchEndTime - touchStartTime;
    const distanceX = Math.abs(touchEndPosition.x - touchStartPosition.x);
    const distanceY = Math.abs(touchEndPosition.y - touchStartPosition.y);

    if (timeDiff < 300 && distanceX < 10 && distanceY < 10) {
        // 模拟点击事件
        const clickEvent = new MouseEvent('click', {
            clientX: touchEndPosition.x,
            clientY: touchEndPosition.y
        });
        onMouseClick(clickEvent);
    }
}

// 辅助函数：获取国家代码
function getCountryCode(countryId) {
    console.log('Getting country code for:', countryId);
    
    // 直接从映射表中查找
    let alpha3Code = countryCodeMap[countryId];
    if (alpha3Code) {
        console.log('Found in mapping:', alpha3Code);
        return alpha3Code;
    }
    
    // 如果是数字，尝试转换为字符串后查找
    if (typeof countryId === 'number') {
        alpha3Code = countryCodeMap[countryId.toString()];
        if (alpha3Code) {
            console.log('Found after number conversion:', alpha3Code);
            return alpha3Code;
        }
    }
    
    // 如果看起来像alpha3代码，直接使用
    if (typeof countryId === 'string' && countryId.length === 3) {
        console.log('Using as alpha3 code:', countryId);
        return countryId;
    }
    
    // 从countries数据中查找
    if (countries) {
        const country = countries.features.find(f => {
            return f.id === countryId || 
                   f.id === parseInt(countryId) || 
                   f.properties.ISO_A3 === countryId ||
                   f.properties.name === countryId;
        });
        if (country) {
            alpha3Code = country.properties.ISO_A3;
            console.log('Found in features:', alpha3Code);
            // 更新映射表
            countryCodeMap[countryId] = alpha3Code;
            countryCodeMap[alpha3Code] = alpha3Code;
            if (typeof countryId === 'number') {
                countryCodeMap[countryId.toString()] = alpha3Code;
            }
            return alpha3Code;
        }
    }
    
    console.log('Country code not found');
    return null;
}

// 添加重试函数
async function fetchWithRetry(url, options, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, {
                ...options,
                // 禁用 keep-alive 连接
                headers: {
                    ...options.headers,
                    'Connection': 'close'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // 使用 Response.blob() 而不是 .text() 或 .json()
            const blob = await response.blob();
            const text = await blob.text();
            
            try {
                return JSON.parse(text);
            } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
                throw new Error('Invalid JSON response');
            }
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            lastError = error;
            
            if (i < maxRetries - 1) {
                // 等待一段时间后重试
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    }
    
    throw lastError;
}

// 修改 showCountryInfo 函数
function showCountryInfo(countryId) {
    console.log('Processing country ID:', countryId);
    
    const alpha3Code = getCountryCode(countryId);
    if (!alpha3Code) {
        console.error('Country not found:', countryId);
        if (confirm('该国家暂无信息，是否添加？')) {
            showEditPanel(countryId);
        }
        return;
    }
    
    console.log('Fetching country data for:', alpha3Code);
    
    // 显示加载状态
    const infoPanel = document.getElementById('info-panel');
    infoPanel.style.display = 'block';
    infoPanel.innerHTML = '<div class="loading">加载中...</div>';
    
    // 使用新的 fetchWithRetry 函数
    fetchWithRetry(
        `${API_BASE_URL}/countries/${alpha3Code}`,
        {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        }
    )
    .then(data => {
        if (!data) {
            throw new Error('No data received');
        }
        console.log('Received country data:', data);
        updateCountryDisplay(data, countryId);
    })
    .catch(error => {
        console.error('Error fetching country data:', error);
        infoPanel.innerHTML = `
            <div class="info-header">
                <h2>在在小朋友～</h2>
                <button id="close-button" aria-label="关闭">×</button>
            </div>
            <div class="info-content empty-state">
                <div class="empty-state-icon">🌍</div>
                <h3>发现新大陆</h3>
                <p>这片土地正等待你的探索与发现</p>
                <div class="action-buttons">
                    <button class="primary-button" onclick="showEditPanel('${countryId}')">
                        <span class="button-text">添加国家信息</span>
                    </button>
                </div>
            </div>
        `;
        
        // 添加 Apple 风格的 CSS
        const style = document.createElement('style');
        style.textContent = `
            .empty-state {
                text-align: center;
                padding: 40px 20px;
                color: #1d1d1f;
            }
            
            .empty-state-icon {
                font-size: 48px;
                margin-bottom: 20px;
                animation: float 3s ease-in-out infinite;
            }
            
            @keyframes float {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-10px); }
                100% { transform: translateY(0px); }
            }
            
            .empty-state h3 {
                font-size: 20px;
                margin-bottom: 12px;
                color: #1d1d1f;
            }
            
            .empty-state p {
                font-size: 16px;
                color: #666;
                margin-bottom: 24px;
            }
            
            .action-buttons {
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .primary-button {
                background: #0071e3;
                color: white;
                border: none;
                padding: 8px 16px;
                font-size: 14px;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
                transform: scale(0.8);
                transform-origin: center;
            }
            
            .primary-button:hover {
                background: #0077ed;
                opacity: 0.9;
                transform: scale(0.84);
            }
            
            .primary-button:active {
                background: #0068d1;
                transform: scale(0.78);
            }
        `;
        document.head.appendChild(style);
    });
}

// 修改图片URL处理函数
function processImageUrl(url) {
    if (!url) return DEFAULT_IMAGES.flag;
    
    // 如果已经是完整的base64格式，直接返回
    if (url.startsWith('data:image')) {
        return url;
    }
    
    // 如果是http(s)链接，返回URL
    if (url.startsWith('http')) {
        return url;
    }
    
    // 如果是纯base64字符串（没有前缀），添加前缀
    if (url.match(/^[A-Za-z0-9+/=]+$/)) {
        return `data:image/jpeg;base64,${url}`;
    }
    
    // 如果是相对路径，添加API基础URL
    if (url.startsWith('images/')) {
        return `${API_BASE_URL}/static/${url}`;
    }
    
    // 如果都不是，返回默认图片
    return DEFAULT_IMAGES.flag;
}

// 将showEditPanel设为全局函数
window.showEditPanel = function(countryId) {
    const editPanel = document.getElementById('edit-panel');
    editPanel.style.display = 'block';
    editPanel.dataset.countryId = countryId;
    
    // 重置面板位置
    editPanel.style.transform = 'translate3d(0px, 0px, 0)';
    
    let alpha3Code = countryCodeMap[countryId];
    if (!alpha3Code && typeof countryId === 'string' && countryId.length === 3) {
        alpha3Code = countryId;
    }
    
    if (alpha3Code) {
        fetch(`${API_BASE_URL}/countries/${alpha3Code}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            }
        })
        .then(response => response.ok ? response.json() : null)
        .then(data => {
            if (data) {
                console.log('Loading existing data for editing:', data);
                
                // 填充基本信息
                document.getElementById('edit-name').value = data.name || '';
                document.getElementById('edit-capital').value = data.capital || '';
                document.getElementById('edit-population').value = data.population || '';
                document.getElementById('edit-area').value = data.area || '';
                
                // 处理图片显示
                if (data.flag && data.flag.image) {
                    const preview = document.querySelector('.flag-preview');
                    const imageUrl = processImageUrl(data.flag.image);
                    if (imageUrl) {
                        preview.innerHTML = `<img src="${imageUrl}" alt="Flag">`;
                    }
                }
                
                if (data.currency) {
                    const preview = document.querySelector('.currency-preview');
                    if (data.currency.image) {
                        const imageUrl = processImageUrl(data.currency.image);
                        if (imageUrl) {
                            preview.innerHTML = `<img src="${imageUrl}" alt="Currency">`;
                        }
                    }
                    if (data.currency.description) {
                        const desc = document.querySelector('.currency-description');
                        if (desc) desc.textContent = data.currency.description;
                    }
                }
                
                if (data.famousAnimal) {
                    const preview = document.querySelector('.animal-preview');
                    if (data.famousAnimal.image) {
                        const imageUrl = processImageUrl(data.famousAnimal.image);
                        if (imageUrl) {
                            preview.innerHTML = `<img src="${imageUrl}" alt="Animal">`;
                        }
                    }
                    if (data.famousAnimal.description) {
                        const desc = document.querySelector('.animal-description');
                        if (desc) desc.textContent = data.famousAnimal.description;
                    }
                }
            }
        })
        .catch(error => {
            console.error('Error loading existing data:', error);
            clearEditPanel();
        });
    } else {
        clearEditPanel();
    }
};

// 添加清空编辑面板函数
function clearEditPanel() {
        document.getElementById('edit-name').value = '';
    document.getElementById('edit-capital').value = '';
    document.getElementById('edit-population').value = '';
    document.getElementById('edit-area').value = '';
        document.querySelectorAll('.preview').forEach(preview => {
            preview.innerHTML = '';
        });
        document.querySelectorAll('.description').forEach(desc => {
            desc.textContent = '';
        });
}

// 修改基本信息生成功能
window.generateBasicInfo = async function() {
    const editPanel = document.getElementById('edit-panel');
    const countryId = editPanel.dataset.countryId;
    const countryName = document.getElementById('edit-name').value;
    const generateButton = document.querySelector('.basic-info button');

    if (!countryName) {
        alert('请先输入国家名称！');
        return;
    }

    const maxRetries = 3;
    let currentRetry = 0;

    while (currentRetry < maxRetries) {
        try {
            // 显示加载状态
            generateButton.disabled = true;
            generateButton.innerHTML = '<span class="loading-spinner"></span> 生成中...';
            
            const basicInfo = document.querySelector('.basic-info');
            basicInfo.style.opacity = '0.5';
            const inputs = basicInfo.querySelectorAll('input');
            inputs.forEach(input => input.disabled = true);

            // 设置请求超时
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

            // 调用我们自己的后端API，由后端转发请求到火山大模型
            const response = await fetch(`${API_BASE_URL}/ai/generate-country-info`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Connection': 'close'  // 禁用 keep-alive
                },
                body: JSON.stringify({
                    type: 'country_info',
                    countryName: countryName,
                    prompt: `请以专业的语气，生成${countryName}的基本信息，包括首都、人口和面积，限制在100字以内。格式要求：首都：xxx；人口：xxx；面积：xxx。`,
                    maxLength: 100
                }),
                signal: controller.signal,
                cache: 'no-store'  // 禁用缓存
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('AI response error:', response.status, errorText);
                throw new Error('生成失败: ' + response.status + ' - ' + errorText);
            }

            // 使用 Response.blob() 来处理响应
            const blob = await response.blob();
            const text = await blob.text();
            const data = JSON.parse(text);
            
            console.log('AI response:', data);
            
            // 直接使用返回的对象数据
            if (data.capital && data.population && data.area) {
                document.getElementById('edit-capital').value = data.capital;
                document.getElementById('edit-population').value = data.population;
                document.getElementById('edit-area').value = data.area;
                break;  // 成功后跳出重试循环
            } else if (data.result || data.text) {
                // 如果返回的是文本格式，则解析文本
                const text = data.result || data.text;
                console.log('Parsing text:', text);
                
                const capitalMatch = text.match(/首都：([^；]+)/);
                const populationMatch = text.match(/人口：([^；]+)/);
                const areaMatch = text.match(/面积：([^；]+)/);
                
                console.log('Matches:', {
                    capital: capitalMatch,
                    population: populationMatch,
                    area: areaMatch
                });
                
                // 填充解析后的信息
                if (capitalMatch) {
                    document.getElementById('edit-capital').value = capitalMatch[1].trim();
                }
                if (populationMatch) {
                    document.getElementById('edit-population').value = populationMatch[1].trim();
                }
                if (areaMatch) {
                    document.getElementById('edit-area').value = areaMatch[1].trim();
                }
                break;  // 成功后跳出重试循环
            } else {
                throw new Error('返回数据格式不正确');
            }

        } catch (error) {
            console.error(`Retry ${currentRetry + 1} failed:`, error);
            currentRetry++;
            
            if (currentRetry === maxRetries) {
                // 最后一次重试也失败了
                console.error('All retries failed:', error);
                alert('生成基本信息失败，请重试: ' + (error.message || '网络错误'));
            } else {
                // 等待一段时间后重试
                await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry));
            }
        } finally {
            // 恢复按钮状态
            generateButton.disabled = false;
            generateButton.innerHTML = 'AI生成';
            
            // 恢复输入状态
            const basicInfo = document.querySelector('.basic-info');
            basicInfo.style.opacity = '1';
            const inputs = basicInfo.querySelectorAll('input');
            inputs.forEach(input => input.disabled = false);
        }
    }
};

// 添加拖拽功能
let isDragging = false;
let currentX;
let currentY;
let initialX;
let initialY;
let xOffset = 0;
let yOffset = 0;

const editPanel = document.getElementById('edit-panel');

editPanel.addEventListener('mousedown', dragStart);
document.addEventListener('mousemove', drag);
document.addEventListener('mouseup', dragEnd);

function dragStart(e) {
    if (e.target === editPanel || e.target.parentNode === editPanel) {
        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        isDragging = true;
        editPanel.classList.add('dragging');
    }
}

function drag(e) {
    if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        setTranslate(currentX, currentY, editPanel);
    }
}

function dragEnd(e) {
    if (isDragging) {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
        editPanel.classList.remove('dragging');
    }
}

function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
}

// 添加重试函数
function retryLoad(countryId) {
    showCountryInfo(countryId);
}

// 添加默认图片的base64编码
const DEFAULT_IMAGES = {
    flag: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH4QgFBCkj5McRRAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAABAElEQVR42u3RAQ0AAAjDMO5fNCCDkC5z0HTVrisFQhCCEIQgBEEIQhCCEAQhCEEIQhCEIAQhCEEQghCEIARBCEIQghAEIQhBCEIQhCAEIQhBEIIQhCAEQQhCEIIQBCEIQQhCEIQgBCEIQRCCEIQgBEEIQhCCEAQhCEEIQhCEIAQhCEEQghCEIARBCEIQghAEIQhBCEIQhCAEIQhBEIIQhCAEQQhCEIIQxPQADiUAATFj0oEAAAAASUVORK5CYII=',
    currency: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH4QgFBCkj5McRRAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAABAElEQVR42u3RAQ0AAAjDMO5fNCCDkC5z0HTVrisFQhCCEIQgBEEIQhCCEAQhCEEIQhCEIAQhCEEQghCEIARBCEIQghAEIQhBCEIQhCAEIQhBEIIQhCAEQQhCEIIQBCEIQQhCEIQgBCEIQRCCEIQgBEEIQhCCEAQhCEEIQhCEIAQhCEEQghCEIARBCEIQghAEIQhBCEIQhCAEIQhBEIIQhCAEQQhCEIIQxPQADiUAATFj0oEAAAAASUVORK5CYII=',
    animal: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABmJLR0QA/wD/AP+gvaeTAAAAB3RJTUUH4QgFBCkj5McRRAAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAABAElEQVR42u3RAQ0AAAjDMO5fNCCDkC5z0HTVrisFQhCCEIQgBEEIQhCCEAQhCEEIQhCEIAQhCEEQghCEIARBCEIQghAEIQhBCEIQhCAEIQhBEIIQhCAEQQhCEIIQBCEIQQhCEIQgBCEIQRCCEIQgBEEIQhCCEAQhCEEIQhCEIAQhCEEQghCEIARBCEIQghAEIQhBCEIQhCAEIQhBEIIQhCAEQQhCEIIQxPQADiUAATFj0oEAAAAASUVORK5CYII='
};

// 修改图片错误处理
function updateCountryDisplay(data, countryId) {
    try {
        console.log('Updating display with data:', data);
        
        // 显示信息面板
        const infoPanel = document.getElementById('info-panel');
        if (!infoPanel) {
            throw new Error('Info panel element not found');
        }
        
        // 构建信息面板的HTML
        let html = `
            <div class="info-header">
                <h2 id="country-name">${data.name || 'Unknown'}</h2>
                <button id="close-button">×</button>
            </div>
            <div class="info-content">
                <div class="basic-info">
                    <p><strong>首都：</strong><span id="capital">${data.capital || 'Unknown'}</span></p>
                    <p><strong>人口：</strong><span id="population">${data.population || 'Unknown'}</span></p>
                    <p><strong>面积：</strong><span id="area">${data.area || 'Unknown'}</span></p>
                </div>
                <div class="flag-section">
                    <h3>国旗</h3>
                    <div class="image-container">
                        <img class="flag info-image" alt="National Flag" src="${processImageUrl(data.flag?.image) || DEFAULT_IMAGES.flag}">
                    </div>
                </div>
                <div class="currency-section">
                    <h3>货币</h3>
                    <div class="image-container">
                        <img class="currency-image info-image" alt="Currency" src="${processImageUrl(data.currency?.image) || DEFAULT_IMAGES.currency}">
                    </div>
                    <p class="currency-description">${data.currency?.description || 'No description available'}</p>
                </div>
                <div class="animal-section">
                    <h3>代表动物</h3>
                    <div class="image-container">
                        <img class="animal-image info-image" alt="Famous Animal" src="${processImageUrl(data.famousAnimal?.image) || DEFAULT_IMAGES.animal}">
                    </div>
                    <p class="animal-description">${data.famousAnimal?.description || 'No description available'}</p>
                </div>
                <div class="button-section">
                    <button id="edit-button" onclick="showEditPanel('${countryId}')">重新编辑</button>
                </div>
            </div>
        `;
        
        // 更新面板内容
        infoPanel.innerHTML = html;
        infoPanel.style.display = 'block';

        // 添加样式到head
        const style = document.createElement('style');
        style.textContent = `
            .info-panel {
                width: 120%;
                max-width: calc(90vw * 1.2);
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
                text-align: left;
            }
            
            .info-content {
                max-height: 80vh;
                overflow-y: auto;
                padding: 24px;
                color: #1d1d1f;
                text-align: left;
            }
            
            .info-content h3 {
                text-align: left;
                margin: 16px 0 8px 0;
            }
            
            .info-content p {
                margin: 8px 0;
                line-height: 1.5;
                text-align: left;
            }
            
            .image-container {
                width: 120%;
                max-height: 240px;
                overflow: hidden;
                display: flex;
                justify-content: flex-start;
                align-items: flex-start;
                margin: 12px 0;
                border-radius: 8px;
            }
            
            .info-image {
                max-width: 120%;
                max-height: 240px;
                object-fit: contain;
                display: block;
                margin-left: 0;
            }
            
            .description {
                color: #515154;
                font-size: 14px;
                line-height: 1.5;
                margin: 8px 0;
                text-align: left;
            }
            
            .button-section {
                text-align: left;
                margin-top: 16px;
            }
        `;
        document.head.appendChild(style);
        
        // 重新添加关闭按钮事件监听器
        const closeButton = document.getElementById('close-button');
        if (closeButton) {
            closeButton.addEventListener('click', function() {
                // 重置所有区域和边界线的颜色
                if (earthGroup && earthGroup.children[1]) {
                    earthGroup.children[1].children.forEach(child => {
                        if (child instanceof THREE.LineSegments) {
                            child.material.color.setHex(0xFFFFFF);
                            child.material.opacity = 0.5;
                        } else if (child instanceof THREE.Mesh) {
                            child.material.color.setHex(0x808080);
                            child.material.opacity = 0.1;
                        }
                    });
                }
                
                // 隐藏信息面板
                infoPanel.style.display = 'none';
                // 恢复自动旋转
                isRotating = true;
            });
        }
        
        // 高亮选中的国家
        highlightSelectedCountry(countryId);
        
        // 添加图片加载错误处理
        const images = infoPanel.getElementsByTagName('img');
        Array.from(images).forEach(img => {
            img.onerror = function() {
                const type = img.className.includes('flag') ? 'flag' :
                           img.className.includes('currency') ? 'currency' : 'animal';
                this.src = DEFAULT_IMAGES[type];
                console.log(`Using default ${type} image`);
            };
        });
        
    } catch (error) {
        console.error('Error updating display:', error);
        // 显示错误信息
        if (infoPanel) {
        infoPanel.innerHTML = `
            <div class="error">
                    <p>加载失败: ${error.message}</p>
                <button onclick="retryLoad('${countryId}')">重试</button>
                    <button onclick="showEditPanel('${countryId}')">编辑信息</button>
            </div>
        `;
        infoPanel.style.display = 'block';
        }
    }
}

// 高亮选中的国家
function highlightSelectedCountry(countryId) {
    earthGroup.children[1].children.forEach(child => {
        if (child instanceof THREE.LineSegments) {
            child.material.color.setHex(0xFFFFFF);
            child.material.opacity = 0.5;
        } else if (child instanceof THREE.Mesh) {
            child.material.color.setHex(0x808080);
            child.material.opacity = 0.1;
        }
        
        if (child.userData.countryId === countryId) {
            if (child instanceof THREE.LineSegments) {
                child.material.color.setHex(0xFFFF00);
                child.material.opacity = 1;
            } else if (child instanceof THREE.Mesh) {
                child.material.color.setHex(0xFFFF00);
                child.material.opacity = 0.3;
            }
        }
    });
}

// 添加关闭按钮事件
document.addEventListener('DOMContentLoaded', function() {
    // 添加编辑按钮事件处理
    const editButton = document.getElementById('edit-button');
    if (editButton) {
        editButton.addEventListener('click', function() {
            console.log('Edit button clicked, selectedCountryId:', selectedCountryId);
            if (selectedCountryId) {
                showEditPanel(selectedCountryId);
            } else {
                console.error('No country selected');
            }
        });
    } else {
        console.error('Edit button not found');
    }

    // 添加关闭按钮事件处理
    const closeButton = document.getElementById('close-button');
    if (closeButton) {
        closeButton.addEventListener('click', function() {
            // 重置所有区域和边界线的颜色
            earthGroup.children[1].children.forEach(child => {
                if (child instanceof THREE.LineSegments) {
                    child.material.color.setHex(0xFFFFFF);
                    child.material.opacity = 0.5;
                } else if (child instanceof THREE.Mesh) {
                    child.material.color.setHex(0x808080);
                    child.material.opacity = 0.1;
                }
            });
            
            // 隐藏信息面板
            document.getElementById('info-panel').style.display = 'none';
            // 隐藏编辑面板
            document.getElementById('edit-panel').style.display = 'none';
            // 恢复自动旋转
            isRotating = true;
        });
    }
});

// 添加鼠标移出信息面板事件
document.getElementById('info-panel').addEventListener('mouseleave', function() {
    isRotating = true;
});

// 处理窗口大小变化
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 添加文件上传预览功能
document.getElementById('flag-upload').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.querySelector('.flag-preview');
            preview.innerHTML = `<img src="${e.target.result}" alt="Flag preview">`;
            console.log('Flag image preview loaded:', e.target.result.substring(0, 100) + '...');
        };
        reader.onerror = function(error) {
            console.error('Error reading flag file:', error);
            alert('图片读取失败，请重试');
        };
        reader.readAsDataURL(file);
    }
});

// 修改编辑面板样式
const style = document.createElement('style');
style.textContent = `
    #edit-panel {
        width: 130%;
        max-width: calc(90vw * 1.3);
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        text-align: left;
        display: none;
        position: relative;
    }
    
    .edit-header {
        padding: 16px 20px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    }
    
    .edit-content {
        padding: 24px;
        color: #1d1d1f;
    }
    
    .image-section {
        margin: 16px 0;
    }
    
    .image-container {
        width: 100%;
        margin-bottom: 12px;
    }
    
    .preview {
        width: 100%;
        height: 200px;
        border: 2px dashed #ccc;
        border-radius: 8px;
        display: flex;
        justify-content: center;
        align-items: center;
        margin-bottom: 12px;
    }
    
    .preview img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }
    
    .image-section button {
        display: block;
        margin: 8px 0;
        transform: scale(0.7);
        transform-origin: left center;
    }
    
    .image-section input[type="file"] {
        margin-bottom: 12px;
    }
    
    .description {
        margin: 8px 0;
        color: #515154;
    }
    
    .basic-info {
        margin-bottom: 24px;
    }
    
    .basic-info input {
        width: 100%;
        padding: 8px;
        margin: 4px 0 12px;
        border: 1px solid #ccc;
        border-radius: 6px;
    }
    
    .basic-info button {
        transform: scale(0.7);
        transform-origin: left center;
    }
`;
