/**
 * Two-dimensional Kalman filter for NTP-style time synchronization.
 *
 * This class implements a time synchronization filter that tracks both the timestamp
 * offset and clock drift rate between a client and server. It processes measurements
 * obtained with NTP-style time messages that contain round-trip timing information to
 * optimally estimate the time relationship while accounting for network latency
 * uncertainty.
 *
 * The filter maintains a 2D state vector [offset, drift] with associated covariance
 * matrix to track estimation uncertainty. An adaptive forgetting factor helps the
 * filter recover quickly from network disruptions or server clock adjustments.
 *
 * Direct port of the Python implementation from aioresonate.
 */

// Residual threshold as fraction of max_error for triggering adaptive forgetting.
// When residual > CUTOFF * max_error, the filter applies forgetting to recover from outliers.
const ADAPTIVE_FORGETTING_CUTOFF = 0.75;

export interface TimeElement {
  last_update: number;
  offset: number;
  drift: number;
}

export class ResonateTimeFilter {
  private _last_update: number = 0;
  private _count: number = 0;

  private _offset: number = 0.0;
  private _drift: number = 0.0;

  private _offset_covariance: number = Infinity;
  private _offset_drift_covariance: number = 0.0;
  private _drift_covariance: number = 0.0;

  private _process_variance: number;
  private _forget_variance_factor: number;

  private _current_time_element: TimeElement;

  constructor(process_std_dev: number = 0.01, forget_factor: number = 1.001) {
    this._process_variance = process_std_dev * process_std_dev;
    this._forget_variance_factor = forget_factor * forget_factor;
    this._current_time_element = this._createDefaultTimeElement();
  }

  /**
   * Create a default TimeElement with zero values.
   * Single source of truth for default initialization.
   */
  private _createDefaultTimeElement(): TimeElement {
    return {
      last_update: 0,
      offset: 0.0,
      drift: 0.0,
    };
  }

  /**
   * Process a new time synchronization measurement through the Kalman filter.
   *
   * Updates the filter's offset and drift estimates using a two-stage Kalman filter
   * algorithm: predict based on the drift model then correct using the new
   * measurement. The measurement uncertainty is derived from the network round-trip
   * delay.
   *
   * @param measurement - Computed offset from NTP-style exchange: ((T2-T1)+(T3-T4))/2 in microseconds
   * @param max_error - Half the round-trip delay: ((T4-T1)-(T3-T2))/2, representing maximum measurement uncertainty in microseconds
   * @param time_added - Client timestamp when this measurement was taken in microseconds
   */
  update(measurement: number, max_error: number, time_added: number): void {
    if (time_added === this._last_update) {
      // Skip duplicate timestamps to avoid division by zero in drift calculation
      return;
    }

    const dt = time_added - this._last_update;
    this._last_update = time_added;

    const update_std_dev = max_error;
    const measurement_variance = update_std_dev * update_std_dev;

    // Filter initialization: First measurement establishes offset baseline
    if (this._count <= 0) {
      this._count += 1;

      this._offset = measurement;
      this._offset_covariance = measurement_variance;
      this._drift = 0.0; // No drift information available yet

      this._current_time_element = {
        last_update: this._last_update,
        offset: this._offset,
        drift: this._drift,
      };

      return;
    }

    // Second measurement: Initial drift estimation from finite differences
    if (this._count === 1) {
      this._count += 1;

      this._drift = (measurement - this._offset) / dt;
      this._offset = measurement;

      // Drift variance estimated from propagation of offset uncertainties
      this._drift_covariance =
        (this._offset_covariance + measurement_variance) / dt;
      this._offset_covariance = measurement_variance;

      this._current_time_element = {
        last_update: this._last_update,
        offset: this._offset,
        drift: this._drift,
      };

      return;
    }

    /// Kalman Prediction Step ///
    // State prediction: x_k|k-1 = F * x_k-1|k-1
    const offset = this._offset + this._drift * dt;

    // Covariance prediction: P_k|k-1 = F * P_k-1|k-1 * F^T + Q
    // State transition matrix F = [1, dt; 0, 1]
    const dt_squared = dt * dt;

    // Process noise only applied to offset (modeling clock jitter/wander)
    const drift_process_variance = 0.0; // Drift assumed stable
    let new_drift_covariance = this._drift_covariance + drift_process_variance;

    const offset_drift_process_variance = 0.0;
    let new_offset_drift_covariance =
      this._offset_drift_covariance +
      this._drift_covariance * dt +
      offset_drift_process_variance;

    const offset_process_variance = dt * this._process_variance;
    let new_offset_covariance =
      this._offset_covariance +
      2 * this._offset_drift_covariance * dt +
      this._drift_covariance * dt_squared +
      offset_process_variance;

    /// Innovation and Adaptive Forgetting ///
    const residual = measurement - offset; // Innovation: y_k = z_k - H * x_k|k-1
    const max_residual_cutoff = max_error * ADAPTIVE_FORGETTING_CUTOFF;

    if (this._count < 100) {
      // Build sufficient history before enabling adaptive forgetting
      this._count += 1;
    } else if (residual > max_residual_cutoff) {
      // Large prediction error detected - likely network disruption or clock adjustment
      // Apply forgetting factor to increase Kalman gain and accelerate convergence
      new_drift_covariance *= this._forget_variance_factor;
      new_offset_drift_covariance *= this._forget_variance_factor;
      new_offset_covariance *= this._forget_variance_factor;
    }

    /// Kalman Update Step ///
    // Innovation covariance: S = H * P * H^T + R, where H = [1, 0]
    const uncertainty = 1.0 / (new_offset_covariance + measurement_variance);

    // Kalman gain: K = P * H^T * S^(-1)
    const offset_gain = new_offset_covariance * uncertainty;
    const drift_gain = new_offset_drift_covariance * uncertainty;

    // State update: x_k|k = x_k|k-1 + K * y_k
    this._offset = offset + offset_gain * residual;
    this._drift += drift_gain * residual;

    // Covariance update: P_k|k = (I - K*H) * P_k|k-1
    // Using simplified form to ensure numerical stability
    this._drift_covariance =
      new_drift_covariance - drift_gain * new_offset_drift_covariance;
    this._offset_drift_covariance =
      new_offset_drift_covariance - drift_gain * new_offset_covariance;
    this._offset_covariance =
      new_offset_covariance - offset_gain * new_offset_covariance;

    this._current_time_element = {
      last_update: this._last_update,
      offset: this._offset,
      drift: this._drift,
    };
  }

  /**
   * Convert a client timestamp to the equivalent server timestamp.
   *
   * Applies the current offset and drift compensation to transform from client time
   * domain to server time domain. The transformation accounts for both static offset
   * and dynamic drift accumulated since the last filter update.
   *
   * @param client_time - Client timestamp in microseconds
   * @returns Equivalent server timestamp in microseconds
   */
  computeServerTime(client_time: number): number {
    // Transform: T_server = T_client + offset + drift * (T_client - T_last_update)
    // Compute instantaneous offset accounting for linear drift:
    // offset(t) = offset_base + drift * (t - t_last_update)

    const dt = client_time - this._current_time_element.last_update;
    const offset = Math.round(
      this._current_time_element.offset + this._current_time_element.drift * dt,
    );
    return client_time + offset;
  }

  /**
   * Convert a server timestamp to the equivalent client timestamp.
   *
   * Inverts the time transformation to convert from server time domain to client
   * time domain. Accounts for both offset and drift effects in the inverse
   * transformation.
   *
   * @param server_time - Server timestamp in microseconds
   * @returns Equivalent client timestamp in microseconds
   */
  computeClientTime(server_time: number): number {
    // Inverse transform solving for T_client:
    // T_server = T_client + offset + drift * (T_client - T_last_update)
    // T_server = (1 + drift) * T_client + offset - drift * T_last_update
    // T_client = (T_server - offset + drift * T_last_update) / (1 + drift)

    return Math.round(
      (server_time -
        this._current_time_element.offset +
        this._current_time_element.drift *
          this._current_time_element.last_update) /
        (1.0 + this._current_time_element.drift),
    );
  }

  /**
   * Reset the filter state.
   */
  reset(): void {
    this._count = 0;
    this._offset = 0.0;
    this._drift = 0.0;
    this._offset_covariance = Infinity;
    this._offset_drift_covariance = 0.0;
    this._drift_covariance = 0.0;

    this._current_time_element = this._createDefaultTimeElement();
  }

  /**
   * Get the number of time sync measurements processed.
   */
  get count(): number {
    return this._count;
  }

  /**
   * Check if time synchronization is ready for use.
   *
   * Time sync is considered ready when at least 2 measurements have been
   * collected and the offset covariance is finite (not infinite).
   */
  get is_synchronized(): boolean {
    return this._count >= 2 && isFinite(this._offset_covariance);
  }

  /**
   * Get the standard deviation estimate in microseconds.
   */
  get error(): number {
    return Math.round(Math.sqrt(this._offset_covariance));
  }

  /**
   * Get the covariance (variance) estimate for the offset.
   */
  get covariance(): number {
    return Math.round(this._offset_covariance);
  }

  /**
   * Get the current filtered offset estimate in microseconds.
   */
  get offset(): number {
    return this._offset;
  }
}
