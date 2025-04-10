// src/BtcCalculator.jsx
import React, { useState, useEffect, useCallback } from "react";

// --- 常量 ---
const MIN_LEVERAGE = 1;
const MAX_LEVERAGE = 125;
const MAINT_MARGIN_RATE = 0.004; // 0.4% 維持保證金率
const DEFAULT_FEE_RATE = 0.0005; // 0.05% 手續費率

// --- 輸入處理函數 ---
const parseValidFloat = (
  value,
  min = -Infinity,
  max = Infinity,
  allowZero = false
) => {
  if (typeof value === "number" && !isNaN(value)) {
    if ((allowZero ? value >= 0 : value > 0) && value >= min && value <= max)
      return value;
    return null;
  }
  if (typeof value !== "string" || value.trim() === "") return null;
  const num = parseFloat(value.trim());
  if (
    isNaN(num) ||
    (!allowZero && num <= 0) ||
    (allowZero && num < 0) ||
    num < min ||
    num > max
  )
    return null;
  return num;
};

const BtcCalculator = () => {
  // --- 初始狀態值 ---
  const initialState = {
    direction: "short",
    manualLeverageInput: "",
    fundsInput: "",
    positionPercent: 10,
    entryPriceInput: "",
    liqPresetInput: "",
    targetPriceInput: "",
  };

  // --- 狀態初始化 ---
  const [direction, setDirection] = useState(initialState.direction);
  const [manualLeverageInput, setManualLeverageInput] = useState(
    initialState.manualLeverageInput
  );
  const [fundsInput, setFundsInput] = useState(initialState.fundsInput);
  const [positionPercent, setPositionPercent] = useState(
    initialState.positionPercent
  );
  const [entryPriceInput, setEntryPriceInput] = useState(
    initialState.entryPriceInput
  );
  const [liqPresetInput, setLiqPresetInput] = useState(
    initialState.liqPresetInput
  );
  const [targetPriceInput, setTargetPriceInput] = useState(
    initialState.targetPriceInput
  );
  const [usdtToTwd, setUsdtToTwd] = useState(null);
  const [twdFetchStatus, setTwdFetchStatus] = useState("loading");
  const [feeRate] = useState(DEFAULT_FEE_RATE);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(""); // 保存狀態提示

  // --- 計算結果狀態 ---
  const [margin, setMargin] = useState("0.00");
  const [derivedLeverage, setDerivedLeverage] = useState(null);
  const [finalLeverage, setFinalLeverage] = useState(null);
  const [positionSize, setPositionSize] = useState("0.000000");
  const [calculationResult, setCalculationResult] = useState(null);

  const isLeverageManuallySet =
    manualLeverageInput !== "" && !isNaN(parseFloat(manualLeverageInput));

  // --- 在組件載入時載入已保存的設定 ---
  useEffect(() => {
    const savedSettings = localStorage.getItem("btcCalculatorSettings");
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setDirection(parsedSettings.direction || initialState.direction);
        setManualLeverageInput(
          parsedSettings.manualLeverageInput || initialState.manualLeverageInput
        );
        setFundsInput(parsedSettings.fundsInput || initialState.fundsInput);
        setPositionPercent(
          parsedSettings.positionPercent || initialState.positionPercent
        );
        setEntryPriceInput(
          parsedSettings.entryPriceInput || initialState.entryPriceInput
        );
        setLiqPresetInput(
          parsedSettings.liqPresetInput || initialState.liqPresetInput
        );
        setTargetPriceInput(
          parsedSettings.targetPriceInput || initialState.targetPriceInput
        );
      } catch (e) {
        console.error("Failed to load saved settings:", e);
      }
    }
  }, []);

  // --- 保存當前設定 ---
  const saveSettings = () => {
    const settings = {
      direction,
      manualLeverageInput,
      fundsInput,
      positionPercent,
      entryPriceInput,
      liqPresetInput,
      targetPriceInput,
    };

    try {
      localStorage.setItem("btcCalculatorSettings", JSON.stringify(settings));
      setSaveStatus("已儲存設定");

      // 2秒後清除保存狀態提示
      setTimeout(() => {
        setSaveStatus("");
      }, 2000);
    } catch (e) {
      console.error("Failed to save settings:", e);
      setSaveStatus("儲存失敗");

      setTimeout(() => {
        setSaveStatus("");
      }, 2000);
    }
  };

  // --- 重置所有設定和計算結果 ---
  const resetSettings = () => {
    // 重置輸入設定
    setDirection(initialState.direction);
    setManualLeverageInput(initialState.manualLeverageInput);
    setFundsInput(initialState.fundsInput);
    setPositionPercent(initialState.positionPercent);
    setEntryPriceInput(initialState.entryPriceInput);
    setLiqPresetInput(initialState.liqPresetInput);
    setTargetPriceInput(initialState.targetPriceInput);

    // 重置計算結果
    setMargin("0.00");
    setDerivedLeverage(null);
    setFinalLeverage(null);
    setPositionSize("0.000000");
    setCalculationResult(null);

    // 重置錯誤和狀態信息
    setError(null);
    setSaveStatus("已重置所有設定");

    // 2秒後清除狀態提示
    setTimeout(() => {
      setSaveStatus("");
    }, 2000);
  };

  // --- 獲取 TWD 匯率 ---
  const fetchExchangeRate = useCallback(async () => {
    setTwdFetchStatus("loading");
    try {
      const response = await fetch(
        "https://api.exchangerate-api.com/v4/latest/USD"
      );
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      if (data?.rates?.TWD) {
        setUsdtToTwd(data.rates.TWD);
        setTwdFetchStatus("success");
      } else {
        throw new Error("Invalid API data format");
      }
    } catch (err) {
      console.error("Failed to fetch TWD rate:", err);
      setUsdtToTwd(null);
      setTwdFetchStatus("error");
    }
  }, []);

  // 載入時自動獲取匯率
  useEffect(() => {
    fetchExchangeRate();

    // 設置一個定時器每小時更新匯率一次
    const intervalId = setInterval(fetchExchangeRate, 3600000); // 3600000ms = 1小時

    // 組件卸載時清除定時器
    return () => clearInterval(intervalId);
  }, [fetchExchangeRate]);

  // --- 主要計算邏輯 ---
  const performCalculations = useCallback(() => {
    setError(null);
    setDerivedLeverage(null);
    setFinalLeverage(null);
    setCalculationResult(null);
    let currentError = null;

    // 1. 解析和驗證輸入
    const parsedFunds = parseValidFloat(fundsInput, 0.01);
    const parsedPosPercent = parseValidFloat(positionPercent, 1, 100);
    const parsedEntry = parseValidFloat(entryPriceInput, 0.01);
    const parsedLiqPreset = parseValidFloat(liqPresetInput, 0.01);
    const parsedTarget = parseValidFloat(targetPriceInput, 0.01);
    let parsedManualLeverage = null;

    // 基礎輸入驗證
    if (!parsedFunds) {
      currentError = "請輸入有效的可用資金 (> 0)";
      setError(currentError);
      return;
    }

    // 2. 計算保證金
    let calculatedMargin = 0;
    if (parsedFunds && parsedPosPercent) {
      calculatedMargin = (parsedFunds * parsedPosPercent) / 100;
      setMargin(calculatedMargin.toFixed(2));
    } else {
      setMargin("0.00");
    }

    // 3. 確定並驗證槓桿
    let leverageToUse = null;
    if (isLeverageManuallySet) {
      parsedManualLeverage = parseValidFloat(
        manualLeverageInput,
        MIN_LEVERAGE,
        MAX_LEVERAGE
      );
      if (parsedManualLeverage === null) {
        currentError = `槓桿必須在 ${MIN_LEVERAGE}~${MAX_LEVERAGE} 之間`;
      } else {
        leverageToUse = parsedManualLeverage;
      }
    } else if (parsedEntry && parsedLiqPreset) {
      if (direction === "long" && parsedLiqPreset >= parsedEntry) {
        currentError = "做多時，預設強平價必須低於開倉價";
      } else if (direction === "short" && parsedLiqPreset <= parsedEntry) {
        currentError = "做空時，預設強平價必須高於開倉價";
      } else {
        try {
          let calculatedDerivedLev = null;
          if (direction === "long") {
            const denominator =
              1 + MAINT_MARGIN_RATE - parsedLiqPreset / parsedEntry;
            if (denominator <= 1e-9) throw new Error("分母過小");
            calculatedDerivedLev = 1 / denominator;
          } else {
            const denominator =
              parsedLiqPreset / parsedEntry - 1 + MAINT_MARGIN_RATE;
            if (denominator <= 1e-9) throw new Error("分母過小");
            calculatedDerivedLev = 1 / denominator;
          }

          setDerivedLeverage(calculatedDerivedLev);

          if (
            calculatedDerivedLev < MIN_LEVERAGE ||
            calculatedDerivedLev > MAX_LEVERAGE
          ) {
            currentError = `推算槓桿 (${calculatedDerivedLev.toFixed(
              2
            )}x) 超出範圍 (${MIN_LEVERAGE}~${MAX_LEVERAGE})`;
          } else {
            leverageToUse = calculatedDerivedLev;
          }
        } catch (e) {
          currentError = "無法根據輸入價格計算槓桿";
        }
      }
    }

    if (currentError) {
      setError(currentError);
      return;
    }

    if (leverageToUse !== null) {
      setFinalLeverage(leverageToUse);
    }

    // 4. 計算倉位大小 (BTC)
    let calculatedSize = 0;
    if (calculatedMargin > 0 && leverageToUse !== null && parsedEntry) {
      calculatedSize = (calculatedMargin * leverageToUse) / parsedEntry;
      setPositionSize(calculatedSize.toFixed(6));
    } else {
      setPositionSize("0.000000");
    }

    // 5. 計算 PNL, Fee, R/R
    if (
      calculatedSize > 0 &&
      leverageToUse !== null &&
      parsedEntry &&
      parsedTarget
    ) {
      // 計算實際強平價
      let actualLiqPriceNum = NaN;
      let actualLiqPriceStr = "N/A";
      try {
        let liqP;
        if (direction === "long") {
          liqP = parsedEntry * (1 - 1 / leverageToUse + MAINT_MARGIN_RATE);
        } else {
          liqP = parsedEntry * (1 + 1 / leverageToUse - MAINT_MARGIN_RATE);
        }
        if (liqP > 0) {
          actualLiqPriceNum = liqP;
          actualLiqPriceStr = liqP.toFixed(2);
        }
      } catch (e) {
        /* 忽略計算錯誤 */
      }

      // 計算盈虧
      const entryValue = calculatedSize * parsedEntry;
      const exitValue = calculatedSize * parsedTarget;
      let grossPnl;
      if (direction === "long") {
        grossPnl = exitValue - entryValue;
      } else {
        grossPnl = entryValue - exitValue;
      }

      // 計算手續費
      const entryFee = entryValue * feeRate;
      const exitFee = exitValue * feeRate;
      const totalFee = entryFee + exitFee;

      // 計算淨盈虧
      const netPnl = grossPnl - totalFee;
      const netPnlTwd =
        usdtToTwd !== null ? (netPnl * usdtToTwd).toFixed(2) : "N/A";

      // 計算風險回報比
      let rRatio = "N/A";
      if (!isNaN(actualLiqPriceNum)) {
        const riskExitValue = calculatedSize * actualLiqPriceNum;
        let potentialLossAmount;
        if (direction === "long") {
          potentialLossAmount = entryValue - riskExitValue;
        } else {
          potentialLossAmount = riskExitValue - entryValue;
        }

        const riskEntryFee = entryFee;
        const riskExitFee = riskExitValue * feeRate;
        const totalRisk = potentialLossAmount + riskEntryFee + riskExitFee;

        if (totalRisk > 1e-9) {
          const potentialReward = Math.abs(netPnl);
          rRatio = (potentialReward / totalRisk).toFixed(2);
        } else if (netPnl > 0) {
          rRatio = "∞";
        }
      }

      setCalculationResult({
        grossPnl: grossPnl.toFixed(2),
        totalFee: totalFee.toFixed(2),
        netPnl: netPnl.toFixed(2),
        netPnlTwd: netPnlTwd,
        rRatio: rRatio,
        actualLiqPrice: actualLiqPriceStr,
      });
    }

    setError(currentError);
  }, [
    fundsInput,
    positionPercent,
    entryPriceInput,
    manualLeverageInput,
    liqPresetInput,
    targetPriceInput,
    direction,
    isLeverageManuallySet,
    feeRate,
    usdtToTwd,
  ]);

  // --- 當依賴項變化時，執行計算 ---
  useEffect(() => {
    performCalculations();
  }, [performCalculations]);

  // --- 格式化函數 ---
  const formatNumberDisplay = (numStr, digits = 2) => {
    const num = parseFloat(numStr);
    if (isNaN(num)) return numStr;
    return num.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  };

  return (
    <div className="calculator-container">
      <div className="calculator-card">
        <div className="calculator-header">
          <h1>BTC 永續合約策略計算器</h1>
          <span className="fee-rate">
            手續費率： {(feeRate * 100).toFixed(2)}% (預設)
          </span>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* 顯示儲存/重置狀態的通知 */}
        {saveStatus && <div className="success-message">{saveStatus}</div>}

        <div className="content-layout">
          {/* 左側輸入區 */}
          <div className="input-area">
            {/* 使用表格式佈局確保對齊 */}
            <div className="input-grid">
              {/* 倉位方向行 */}
              <div className="input-row">
                <div className="input-label required">倉位方向：</div>
                <div className="input-field">
                  <div className="radio-group">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="direction"
                        value="long"
                        checked={direction === "long"}
                        onChange={(e) => setDirection(e.target.value)}
                      />
                      做多
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="direction"
                        value="short"
                        checked={direction === "short"}
                        onChange={(e) => setDirection(e.target.value)}
                      />
                      做空
                    </label>
                  </div>
                </div>
              </div>

              {/* 槓桿大小行 - 移除"非必填"文字 */}
              <div className="input-row">
                <div className="input-label">槓桿大小 (1~125)：</div>
                <div className="input-field">
                  <input
                    type="number"
                    value={manualLeverageInput}
                    onChange={(e) => setManualLeverageInput(e.target.value)}
                    placeholder="自動推算槓桿"
                    className="text-input"
                  />
                </div>
              </div>

              {/* 可用資金行 */}
              <div className="input-row">
                <div className="input-label required">可用資金 (USDT)：</div>
                <div className="input-field">
                  <input
                    type="number"
                    value={fundsInput}
                    onChange={(e) => setFundsInput(e.target.value)}
                    placeholder="0.00"
                    className="text-input"
                  />
                </div>
              </div>

              {/* 倉位大小行 */}
              <div className="input-row">
                <div className="input-label required">倉位大小 (%)：</div>
                <div className="input-field">
                  <div className="slider-container">
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={positionPercent}
                      onChange={(e) =>
                        setPositionPercent(parseInt(e.target.value))
                      }
                      className="slider"
                    />
                    <div className="slider-value">
                      {positionPercent}%, 投入保證金：{" "}
                      {margin !== "0.00"
                        ? `${formatNumberDisplay(margin)} USDT`
                        : "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* 開倉價格行 */}
              <div className="input-row">
                <div className="input-label required">開倉價格 (USDT)：</div>
                <div className="input-field">
                  <input
                    type="number"
                    value={entryPriceInput}
                    onChange={(e) => setEntryPriceInput(e.target.value)}
                    placeholder="0.00"
                    className="text-input"
                  />
                </div>
              </div>

              {/* 預設強平價格行 */}
              <div className="input-row">
                <div
                  className={`input-label ${
                    !isLeverageManuallySet ? "required" : ""
                  }`}
                >
                  預設強平價格 (USDT)：
                </div>
                <div className="input-field">
                  <input
                    type="number"
                    value={liqPresetInput}
                    onChange={(e) => setLiqPresetInput(e.target.value)}
                    placeholder="用於推算槓桿"
                    className="text-input"
                  />
                </div>
              </div>

              {/* 目標價格行 */}
              <div className="input-row">
                <div className="input-label">目標價格 (USDT)：</div>
                <div className="input-field">
                  <input
                    type="number"
                    value={targetPriceInput}
                    onChange={(e) => setTargetPriceInput(e.target.value)}
                    placeholder="預期平倉價格 (用於計算盈虧)"
                    className="text-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 右側結果區 */}
          <div className="results-section">
            <h2>計算結果</h2>
            <div className="result-row">
              <span className="result-label">保證金金額：</span>
              <span className="result-value">
                {formatNumberDisplay(margin)} USDT
              </span>
            </div>
            <div className="result-row">
              <span className="result-label">推導槓桿為：</span>
              <span
                className={`result-value ${
                  isLeverageManuallySet ? "blue" : "green"
                }`}
              >
                {finalLeverage ? `${finalLeverage.toFixed(1)} 倍` : "-"}
              </span>
            </div>
            <div className="result-row">
              <span className="result-label">成交數量：</span>
              <span className="result-value">{positionSize} BTC</span>
            </div>
            <div className="result-row">
              <span className="result-label">盈虧(未扣手續費)：</span>
              <span
                className={`result-value ${
                  calculationResult &&
                  parseFloat(calculationResult.grossPnl) >= 0
                    ? "green"
                    : "red"
                }`}
              >
                {calculationResult
                  ? `${
                      parseFloat(calculationResult.grossPnl) >= 0 ? "+" : ""
                    }${formatNumberDisplay(calculationResult.grossPnl)} USDT`
                  : "-"}
              </span>
            </div>
            <div className="result-row">
              <span className="result-label">手續費：</span>
              <span className="result-value">
                {calculationResult
                  ? `${formatNumberDisplay(calculationResult.totalFee)} USDT`
                  : "-"}
              </span>
            </div>
            <div className="result-row">
              <span className="result-label">淨盈虧：</span>
              <span
                className={`result-value ${
                  calculationResult && parseFloat(calculationResult.netPnl) >= 0
                    ? "green"
                    : "red"
                }`}
              >
                {calculationResult
                  ? `${
                      parseFloat(calculationResult.netPnl) >= 0 ? "+" : ""
                    }${formatNumberDisplay(calculationResult.netPnl)} USDT`
                  : "-"}
                {calculationResult && calculationResult.netPnlTwd !== "N/A" && (
                  <span className="subvalue">
                    (約 {formatNumberDisplay(calculationResult.netPnlTwd)} TWD)
                  </span>
                )}
                {calculationResult && calculationResult.netPnlTwd === "N/A" && (
                  <span className="subvalue">(TWD 匯率無法獲取)</span>
                )}
              </span>
            </div>
            <div className="result-row">
              <span className="result-label">盈虧比 R：</span>
              <span
                className={`result-value ${
                  calculationResult
                    ? calculationResult.rRatio === "∞"
                      ? "purple"
                      : calculationResult.rRatio === "N/A"
                      ? "gray"
                      : parseFloat(calculationResult.rRatio) >= 1
                      ? "green"
                      : "orange"
                    : "gray"
                }`}
              >
                {calculationResult ? calculationResult.rRatio : "-"}
              </span>
            </div>
          </div>
        </div>

        {/* 按鈕區域 */}
        <div className="action-buttons">
          <button onClick={saveSettings} className="save-button">
            儲存設定
          </button>
          <button onClick={resetSettings} className="reset-button">
            重置設定
          </button>
        </div>
      </div>

      <style jsx>{`
        .calculator-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
          background-color: #f5f7f9;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
            Arial, sans-serif;
        }

        .calculator-card {
          width: 100%;
          max-width: 960px;
          background-color: #ffffff;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          overflow: hidden;
        }

        .calculator-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          border-bottom: 1px solid #f0f0f0;
        }

        .calculator-header h1 {
          font-size: 20px;
          font-weight: 600;
          color: #333;
          margin: 0;
        }

        .fee-rate {
          font-size: 14px;
          color: #666;
        }

        .error-message {
          background-color: #fff3cd;
          border: 1px solid #ffeeba;
          color: #856404;
          padding: 10px 16px;
          margin: 16px;
          border-radius: 4px;
          text-align: center;
        }

        .success-message {
          background-color: #d4edda;
          border: 1px solid #c3e6cb;
          color: #155724;
          padding: 10px 16px;
          margin: 16px;
          border-radius: 4px;
          text-align: center;
          transition: opacity 0.3s;
        }

        .content-layout {
          display: flex;
          padding: 16px;
          gap: 20px;
        }

        .input-area {
          flex: 3;
          background-color: #fff;
          border-radius: 4px;
        }

        .input-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }

        .input-row {
          display: grid;
          grid-template-columns: 180px 1fr;
          align-items: center;
          gap: 12px;
        }

        .input-label {
          font-size: 14px;
          color: #333;
          text-align: right;
          white-space: nowrap;
        }

        .input-label.required:before {
          content: "*";
          color: #e53e3e;
          margin-right: 2px;
        }

        .input-field {
          display: flex;
          align-items: center;
        }

        .radio-group {
          display: flex;
          gap: 16px;
        }

        .radio-label {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .text-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .text-input:focus {
          outline: none;
          border-color: #1890ff;
          box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.1);
        }

        .slider-container {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .slider {
          width: 100%;
          height: 6px;
          background: #e2e8f0;
          border-radius: 4px;
          outline: none;
          -webkit-appearance: none;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #3182ce;
          cursor: pointer;
        }

        .slider-value {
          font-size: 12px;
          color: #666;
        }

        .results-section {
          flex: 2;
          background-color: #fff;
          border-radius: 4px;
          padding: 16px;
        }

        .results-section h2 {
          text-align: center;
          font-size: 16px;
          font-weight: 500;
          color: #333;
          margin: 0 0 16px 0;
          padding-bottom: 8px;
          border-bottom: 1px solid #f0f0f0;
        }

        .result-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #f0f0f0;
          font-size: 14px;
        }

        .result-row:last-child {
          border-bottom: none;
        }

        .result-label {
          color: #666;
        }

        .result-value {
          font-weight: 500;
          color: #333;
          text-align: right;
        }

        .subvalue {
          font-size: 12px;
          color: #666;
          margin-left: 4px;
          display: block;
          text-align: right;
        }

        /* 按鈕樣式 */
        .action-buttons {
          display: flex;
          justify-content: center;
          gap: 16px;
          padding: 16px;
          border-top: 1px solid #f0f0f0;
        }

        .save-button,
        .reset-button {
          padding: 8px 24px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .save-button {
          background-color: #1890ff;
          color: white;
        }

        .save-button:hover {
          background-color: #096dd9;
        }

        .reset-button {
          background-color: #f5f5f5;
          color: #595959;
          border: 1px solid #d9d9d9;
        }

        .reset-button:hover {
          background-color: #e8e8e8;
          color: #333;
        }

        .green {
          color: #38a169;
        }
        .red {
          color: #e53e3e;
        }
        .blue {
          color: #3182ce;
        }
        .orange {
          color: #dd6b20;
        }
        .purple {
          color: #805ad5;
        }
        .gray {
          color: #718096;
        }

        /* 響應式設計 */
        @media screen and (max-width: 768px) {
          .content-layout {
            flex-direction: column;
          }

          .input-row {
            grid-template-columns: 1fr;
          }

          .input-label {
            text-align: left;
          }

          .action-buttons {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </div>
  );
};

export default BtcCalculator;
