// utils.sjs - 支付宝 SJS 模块
// 注意：SJS 环境极度受限，禁止使用 Array/Object 等全局标识符

function includes(arr, item) {
  if (!arr) return false;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] === item) return true;
  }
  return false;
}

export default { includes };
