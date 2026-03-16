// Effect definitions — each has a shader source for Skia processing
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
        image: require('../../assets/home/effect/nomal.png'),
        shader: normalShader,
    },
    {
        id: 'swirl',
        name: 'Swirl',
        icon: 'blur-circular',
        image: require('../../assets/home/effect/swirl.png'),
        shader: swirlShader,
    },
    {
        id: 'grid',
        name: 'Grid',
        icon: 'grid-on',
        image: require('../../assets/home/effect/grid.png'),
        shader: gridShader,
    },
    {
        id: 'mirror',
        name: 'Mirror',
        icon: 'flip',
        image: require('../../assets/home/effect/mirror.png'),
        shader: mirrorShader,
    },
    {
        id: 'double',
        name: 'Double',
        icon: 'filter-none',
        image: require('../../assets/home/effect/double.png'),
        shader: doubleShader,
    },
    {
        id: 'waterfall',
        name: 'Waterfall',
        icon: 'water',
        image: require('../../assets/home/effect/waterfall.png'),
        shader: waterfallShader,
    },
    {
        id: 'split',
        name: 'Split',
        icon: 'vertical-split',
        image: require('../../assets/home/effect/split.png'),
        shader: splitShader,
    },
    {
        id: 'single',
        name: 'Single',
        icon: 'horizontal-split',
        image: require('../../assets/home/effect/single.png'),
        shader: singleShader,
    },
];

export default EFFECTS;
