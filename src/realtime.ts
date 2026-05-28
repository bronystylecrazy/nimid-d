// @ts-nocheck
import React from 'react';

function defaultRealtimeUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/events`;
}

export const REALTIME_URL = import.meta.env.VITE_REALTIME_URL || defaultRealtimeUrl();
export const MQTT_SHAKE_TOPIC = 'v1/shake';
export const MQTT_DETECTION_TOPIC = 'v1/detection';
export const MQTT_SHAKE_EVENT = 'nimidd:mqtt-shake';
export const MQTT_DETECTION_EVENT = 'nimidd:mqtt-detection';
export const MQTT_STATUS_EVENT = 'nimidd:mqtt-status';

export function publishMqttStatus(status) {
  window.dispatchEvent(new CustomEvent(MQTT_STATUS_EVENT, { detail: status }));
}

export function isShakeTopic(topic) {
  return String(topic || '') === MQTT_SHAKE_TOPIC;
}

export function useRealtimeEvents() {
  React.useEffect(() => {
    let socket = null;
    let reconnectTimer = null;
    let stopped = false;

    const scheduleReconnect = () => {
      if (stopped || reconnectTimer) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, 1000);
    };

    const connect = () => {
      window.__mqttStatus = socket ? 'reconnecting' : 'connecting';
      publishMqttStatus(window.__mqttStatus);

      socket = new WebSocket(REALTIME_URL);
      socket.addEventListener('open', () => {
        window.__mqttStatus = 'connected';
        publishMqttStatus('connected');
      });
      socket.addEventListener('message', (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }
        window.__lastMqttMessage = {
          topic: String(message.topic || ''),
          payload: message.payload || '',
          data: message.data || null,
          at: message.at || new Date().toISOString(),
        };
        if (message.topic === MQTT_SHAKE_TOPIC) {
          window.dispatchEvent(new CustomEvent(MQTT_SHAKE_EVENT));
        }
        if (message.topic === MQTT_DETECTION_TOPIC && message.data) {
          window.dispatchEvent(new CustomEvent(MQTT_DETECTION_EVENT, { detail: message.data }));
        }
      });
      socket.addEventListener('close', () => {
        window.__mqttStatus = 'closed';
        publishMqttStatus('closed');
        scheduleReconnect();
      });
      socket.addEventListener('error', () => {
        window.__mqttStatus = 'error';
        publishMqttStatus('error');
        socket?.close();
      });
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);
}
