// 当DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
  // 获取DOM元素
  const secretIdInput = document.getElementById('secretId');
  const secretKeyInput = document.getElementById('secretKey');
  const regionSelect = document.getElementById('region');
  const targetLangSelect = document.getElementById('targetLang');
  const saveButton = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');
  
  // 从存储中加载设置
  loadSettings();
  
  // 保存按钮点击事件
  saveButton.addEventListener('click', function() {
    saveSettings();
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