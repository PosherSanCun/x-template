import '@demon673/panorama-polyfill/lib/console';
import '@demon673/panorama-polyfill/lib/timers';

import React from 'react';
import { render, useGameEvent } from '@demon673/react-panorama';
import { useXNetTableKey } from '../hooks/useXNetTable';

const Test: React.FC = () => {
    useGameEvent(`test_event`, () => {
        console.log(`test_event`);
    });
    const [data] = useXNetTableKey(`test_table`, `test_key`, { data_1: `unknown` });
    const string_data = data.data_1;
    return React.useMemo(() => <Label text={`${string_data}`} />, [string_data]);
};

render(<Test />, $.GetContextPanel());

console.log(`Hello, world!`);

setInterval(() => {
    GameEvents.SendCustomGameEventToAllClients(`test_event`, {} as never);
}, 1000);
