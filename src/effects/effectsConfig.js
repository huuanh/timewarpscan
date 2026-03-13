// Effect definitions — each maps to a Skia RuntimeShader SkSL source
import normalShader from './shaders/normal';
import swirlShader from './shaders/swirl';
import gridShader from './shaders/grid';
import mirrorShader from './shaders/mirror';
import doubleShader from './shaders/double';
import waterfallShader from './shaders/waterfall';
import splitShader from './shaders/split';
import singleShader from './shaders/single';

const EFFECTS = [
    {
        id: 'normal',
        name: 'Normal',
        icon: 'crop-original',
        shader: normalShader,
    },
    {
        id: 'swirl',
        name: 'Swirl',
        icon: 'blur-circular',
        shader: swirlShader,
    },
    {
        id: 'grid',
        name: 'Grid',
        icon: 'grid-on',
        shader: gridShader,
    },
    {
        id: 'mirror',
        name: 'Mirror',
        icon: 'flip',
        shader: mirrorShader,
    },
    {
        id: 'double',
        name: 'Double',
        icon: 'filter-none',
        shader: doubleShader,
    },
    {
        id: 'waterfall',
        name: 'Waterfall',
        icon: 'water',
        shader: waterfallShader,
    },
    {
        id: 'split',
        name: 'Split',
        icon: 'vertical-split',
        shader: splitShader,
    },
    {
        id: 'single',
        name: 'Single',
        icon: 'horizontal-split',
        shader: singleShader,
    },
];

export default EFFECTS;
