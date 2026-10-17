requirejs.config({
    baseUrl: "content/zeus3_prt/lib",
    waitSeconds: 60,
    paths: {
        /**
         * GSAP Paths for game libs
         */
        TweenLite:          "gsap/TweenLite",
        TweenMax:           "gsap/TweenMax",
        TimelineMax:        "gsap/TimelineMax",
        TimelineLite:       "gsap/TimelineLite",
        /**
         * Borg library paths
         */
        assets_createjs:    "borg/assets_createjs/assets",
        assets_pixi:        "borg/assets_pixi/assets",
        rendering_createjs: "borg/rendering_createjs/rendering",
        rendering_pixi:     "borg/rendering_pixi/rendering",
        audio_buzz:         "borg/audio_buzz/audio",
        audio_howler:       "borg/audio_howler/audio",
        event_simple:       "borg/event_simple/event",
        event_signal:       "borg/event_signal/event",
        /**
         * Borg external library paths
         */
        pixi:               "borg/external_libs/pixi",
        preloadjs:          "borg/external_libs/preloadjs",
        easeljs:            "borg/external_libs/easeljs-0.8.2.combined",
        howler:             "borg/external_libs/howler",
        buzz:               "borg/external_libs/buzz.min",
    },
    shim:
    {
        /**
         * You can change libraries in the list below
         * 
         * e.g. 'rendering_pixi' to 'rendering_createjs'
         * 
         * Make sure you copy the associated folders to 'MY_GAME/imported_libs/borg'
         */
        'game_libs': {
            deps: [
                'assets_createjs',
                'rendering_createjs',
                'audio_howler',
                'event_simple',
                'stats',
                'spine',
                'proton',
                'TweenMax'
            ]
        },
        /**
         * Main game dependencies
         */
        '../app/js/main': {
            deps: ['game_libs']
        },
        /**
         * Borg library dependencies
         */
        'assets_pixi': {
            deps: ['pixi']
        },
        'assets_createjs': {
            deps: ['preloadjs']
        },
        'rendering_pixi': {
            deps: ['pixi']
        },
        'rendering_createjs': {
            deps: ['easeljs']
        },
        'audio_howler': {
            deps: ['howler']
        },
        'audio_buzz': {
            deps: ['buzz']
        }
    }
});
