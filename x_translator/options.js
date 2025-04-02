// 当DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const secretIdInput = document.getElementById('secretId');
  const secretKeyInput = document.getElementById('secretKey');
  const regionSelect = document.getElementById('region');
  const targetLangSelect = document.getElementById('targetLang');
  const saveButton = document.getElementById('saveBtn');
  const closeButton = document.getElementById('closeBtn');
  const statusDiv = document.getElementById('status');
  const testButton = document.getElementById('testBtn');
  const testTextInput = document.getElementById('testText');
  const testResultDiv = document.getElementById('testResult');
  
  // 从存储中加载设置
  loadSettings();
  
  // 保存按钮点击事件
  saveButton.addEventListener('click', function() {
    saveSettings();
  });
  
  // 关闭按钮点击事件
  closeButton.addEventListener('click', function() {
    window.close();
  });
  
  // 测试按钮点击事件
  testButton.addEventListener('click', function() {
    testApiConnection();
  });
  
  // 加载设置
  function loadSettings() {
    chrome.storage.sync.get(
      [
        'tencentSecretId',
        'tencentSecretKey',
        'tencentRegion',
        'targetLanguage'
      ],
      function(result) {
        // 填充表单
        if (result.tencentSecretId) {
          secretIdInput.value = result.tencentSecretId;
        }
        
        if (result.tencentSecretKey) {
          secretKeyInput.value = result.tencentSecretKey;
        }
        
        if (result.tencentRegion) {
          regionSelect.value = result.tencentRegion;
        }
        
        if (result.targetLanguage) {
          targetLangSelect.value = result.targetLanguage;
        }
      }
    );
  }
  
  // 保存设置
  function saveSettings() {
    const secretId = secretIdInput.value.trim();
    const secretKey = secretKeyInput.value.trim();
    const region = regionSelect.value;
    const targetLang = targetLangSelect.value;
    
    // 验证输入
    if (!secretId || !secretKey) {
      showStatus('请输入SecretId和SecretKey', 'error');
      return;
    }
    
    // 保存到Chrome存储
    chrome.storage.sync.set(
      {
        'tencentSecretId': secretId,
        'tencentSecretKey': secretKey,
        'tencentRegion': region,
        'targetLanguage': targetLang
      },
      function() {
        // 显示保存成功
        showStatus('设置已保存', 'success');
        
        // 通知background脚本更新设置
        chrome.runtime.sendMessage({ action: 'settingsUpdated' });
      }
    );
  }
  
  // 测试API连接
  function testApiConnection() {
    const secretId = secretIdInput.value.trim();
    const secretKey = secretKeyInput.value.trim();
    const region = regionSelect.value;
    const targetLang = targetLangSelect.value;
    const testText = testTextInput.value.trim();
    
    // 验证输入
    if (!secretId || !secretKey) {
      showStatus('请先输入SecretId和SecretKey', 'error');
      return;
    }
    
    if (!testText) {
      showStatus('请输入测试文本', 'error');
      return;
    }
    
    // 保存当前设置（临时）
    chrome.storage.sync.set(
      {
        'tencentSecretId': secretId,
        'tencentSecretKey': secretKey,
        'tencentRegion': region,
        'targetLanguage': targetLang
      },
      function() {
        // 通知background脚本更新设置
        chrome.runtime.sendMessage({ action: 'settingsUpdated' }, function() {
          // 设置已更新，现在尝试翻译
          testTranslation(testText, targetLang);
        });
      }
    );
  }
  
  // 执行测试翻译
  function testTranslation(text, targetLang) {
    // 显示加载状态
    testButton.disabled = true;
    testButton.textContent = '测试中...';
    testResultDiv.textContent = '正在连接API...';
    testResultDiv.style.display = 'block';
    
    // 发送翻译请求
    chrome.runtime.sendMessage(
      { 
        action: 'translate', 
        text: text,
        sourceLang: 'auto',
        targetLang: targetLang
      },
      function(response) {
        testButton.disabled = false;
        testButton.textContent = '测试API连接';
        
        if (response && response.translatedText) {
          // 成功
          testResultDiv.innerHTML = '<strong>测试成功!</strong>\n\n原文: ' + 
                                   text + '\n\n译文: ' + 
                                   response.translatedText;
          testResultDiv.style.backgroundColor = '#e8f5e9';
          showStatus('API连接测试成功', 'success');
        } else {
          // 失败
          testResultDiv.innerHTML = '<strong>测试失败!</strong>\n\n' + 
                                   '错误: ' + (response?.error || '未知错误') + 
                                   '\n\n请检查您的API密钥和网络连接。';
          testResultDiv.style.backgroundColor = '#ffebee';
          showStatus('API连接测试失败: ' + (response?.error || '未知错误'), 'error');
        }
      }
    );
  }
  
  // 显示状态消息
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    
    // 5秒后隐藏状态消息
    setTimeout(function() {
      statusDiv.className = 'status';
    }, 5000);
  }
}); 