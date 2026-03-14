// HubbleTimer Visualization
import React, { useEffect, useState } from 'react';
import { useConnectorData, useWidgetConfig } from '@hubble/sdk';
// import { Badge, Field } from 'hubble-ui'; // Available hubble-ui components: Button, IconButton, Input, Select, Slider, Toggle, ColorPicker, StatusDot, Badge, Field, Collapsible
import './style.css';

interface HubbleTimerData {
  message: string;
}

const HubbleTimerViz = () => {
  const data = useConnectorData<HubbleTimerData>();
  const config = useWidgetConfig<{ title?: string }>();

  if (!data) {
    return <div className="hubble-timer-loading">Waiting for data...</div>;
  }

  return (
    <div className="hubble-timer-container">
      {config.title && <h3 className="hubble-timer-title">{config.title}</h3>}
      <p>{data.message}</p>
    </div>
  );
};

export default HubbleTimerViz;

// Hardware button handler example:
// sdk.onButton('button1', (action, payload) => {
//   if (action === 'start') { /* handle */ }
// });
