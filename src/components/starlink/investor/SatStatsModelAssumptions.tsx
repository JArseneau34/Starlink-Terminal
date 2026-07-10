import { useEffect, useState } from 'react';
import type { SatStatsModelAssumption } from '../../../types/satStats';
import { MODEL_OPTIONS } from '../../../types/satStats';

interface SatStatsModelAssumptionsProps {
  models: SatStatsModelAssumption[];
  busy: boolean;
  onSave: (model: SatStatsModelAssumption) => void;
}

export function SatStatsModelAssumptions({ models, busy, onSave }: SatStatsModelAssumptionsProps) {
  const [modelKey, setModelKey] = useState<string>(MODEL_OPTIONS[0]!.key);
  const [massKg, setMassKg] = useState('');
  const [downlinkGbps, setDownlinkGbps] = useState('');

  useEffect(() => {
    const existing = models.find((m) => m.model_key === modelKey);
    if (existing) {
      setMassKg(String(existing.mass_kg));
      setDownlinkGbps(String(existing.downlink_gbps_per_sat));
    }
  }, [modelKey, models]);

  const handleSave = () => {
    const mass_kg = Number(massKg);
    const downlink_gbps_per_sat = Number(downlinkGbps);
    if (!Number.isFinite(mass_kg) || !Number.isFinite(downlink_gbps_per_sat)) return;
    onSave({ model_key: modelKey, mass_kg, downlink_gbps_per_sat });
  };

  return (
    <div className="starlink-inv-block sat-stats-assumptions">
      <div className="mesh-overlay-label">Model assumptions</div>
      <p className="starlink-inv-block-desc">
        Mass and downlink capacity per satellite generation — drives bandwidth compute
      </p>
      <div className="sat-stats-assumption-form">
        <label className="sat-stats-field">
          <span>Model</span>
          <select
            className="mesh-deploy-select"
            value={modelKey}
            onChange={(e) => setModelKey(e.target.value)}
          >
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="sat-stats-field">
          <span>Mass (kg)</span>
          <input
            className="sat-stats-input"
            type="number"
            value={massKg}
            onChange={(e) => setMassKg(e.target.value)}
          />
        </label>
        <label className="sat-stats-field">
          <span>Downlink (Gbps/sat)</span>
          <input
            className="sat-stats-input"
            type="number"
            value={downlinkGbps}
            onChange={(e) => setDownlinkGbps(e.target.value)}
          />
        </label>
        <button type="button" className="mesh-toggle mesh-toggle-on" disabled={busy} onClick={handleSave}>
          save assumption
        </button>
      </div>
    </div>
  );
}
