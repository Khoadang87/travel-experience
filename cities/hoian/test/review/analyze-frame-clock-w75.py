import json,sys
from collections import defaultdict
from pathlib import Path
raw=json.loads(Path(sys.argv[1]).read_text());groups=defaultdict(list)
for row in raw:
    prefix='Hoian input media '
    if not row.get('message','').startswith(prefix):continue
    event=json.loads(row['message'][len(prefix):]);groups[event['sequence']].append(event)
result=[]
for sequence,events in groups.items():
    starts=[x for x in events if x['kind'] in ('key-start','input-start')]
    if not starts:continue
    start=starts[0];releases=[x for x in events if x['kind'] in ('key-release','input-release')]
    end=releases[0] if releases else events[-1]
    frames=[x for x in events if x['kind']=='frame-callback' and x['at']<=end['at']]
    result.append({'sequence':sequence,'input_kind':start['kind'],'start_time':start.get('time'),'release_time':end.get('time'),'hold_ms':end['at']-start['at'],'clock_delta':end.get('time',0)-start.get('time',0),'frame_callback_count_before_release':len(frames),'frame_media_times_before_release':[x.get('frame',{}).get('mediaTime') for x in frames],'frame_processing_duration_seconds':[x.get('frame',{}).get('processingDuration') for x in frames],'start_buffered':start.get('buffered'),'release_buffered':end.get('buffered'),'release_seeking':end.get('seeking'),'pause_reasons':[x.get('reason') for x in events if x['kind']=='pause-request'],'seek_events':[x['kind'] for x in events if 'seek' in x['kind']]})
print(json.dumps({'sequences':result,'limits':'Callback metadata is not projected canvas pixel change or screen compositor latency; absence of callback does not imply absent decoded frames. Instrumentation may affect timing; no causal attribution or phone acceptance.'},indent=2))
