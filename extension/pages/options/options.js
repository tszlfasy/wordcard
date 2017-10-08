/**
 * @file options
 * @author solopea@gmail.com
 */

import Vue from 'vue'
import ElementUI from 'element-ui'
import _ from 'underscore'
import 'element-ui/lib/theme-default/index.css'
import './options.scss'
import ga from '../../js/common/ga'
import changelog from '../../js/info/changelog'
import browser from 'webextension-polyfill'
import { getSyncConfig } from '../../js/common/config'
import { WORD_LEVEL } from '../../js/constant/options'

const chrome = window.chrome;
const bg = chrome.extension.getBackgroundPage();
const manifest = chrome.runtime.getManifest();
const version = manifest.version;
const appName = 'wordcard';
const storeId = 'oegblnjiajbfeegijlnblepdodmnddbk';

Vue.use(ElementUI)

function init() {
    getSyncConfig().then(config => {
        console.log(config);
        let i18nTexts = getI18nTexts();
        
        ga();
        render(config, i18nTexts);
    });
}

function getI18nTexts(obj) {
    let texts = {};

    try {
        for (let cate in obj) {
            let subobj = texts[cate] = {};

            for (var key in obj[cate]) {
                subobj[key] = chrome.i18n.getMessage(`${cate}_${key}`);
            }
        }
    } catch (e) {
        console.log(e);
    }

    return texts;
}

function render(config, i18nTexts) {
    let activeName = 'general';
    
    if (config.version < version) {
        config.version = version;
        activeName = 'update';
    }

    new Vue({
        el: '#app',
        data: function() {
            return {
                activeName,
                changelog,
                appName,
                storeId,
                config,
                i18nTexts,
                words: [],
                filter: {
                    wordSearchText: '',
                    level: '',
                    tags: []
                },
                tags: []
            }
        },

        computed: {
            filteredWords() {
                let { wordSearchText, level, tags } = this.filter;

                if (!this.words.length) {
                    return [];
                }

                let results = this.words;

                if (wordSearchText) {
                    results = results.filter(word => {
                        // TODO: 连同sentence一起筛选
                        return word.name.toLowerCase().indexOf(wordSearchText.toLowerCase()) !== -1;
                    });
                }

                if (typeof level === 'number') {
                    results = results.filter(word => word.state === level);
                }

                if (tags.length) {
                    results = results.filter(({tags: wtags = []}) => {
                        if (!wtags.length) {
                            return false;
                        }

                        let hasTag = false;

                        tags.forEach(tag => {
                            if (wtags.indexOf(tag) > -1) {
                                hasTag = true;
                            }
                        });

                        return hasTag;
                    });
                }

                return results;
            }
        },

        watch: {
            activeName() {
                if (this.activeName === 'words') {
                    this.loadWords();
                }
            },

            words() {
                let allTags = [];

                this.words.forEach(({ tags = [] }) => {
                    allTags = allTags.concat(tags);
                });

                this.tags = _.uniq(allTags);
            }
        },
        mounted: function() {
            if (this.activeName === 'words') {
                this.loadWords();
            }

            if (activeName === 'update') {
                this.$nextTick(() => {
                    this.saveConfig(true);
                });
            }
        },
        methods: {
            handleClick: function(tab) {
                _gaq.push(['_trackEvent', 'options_tab', 'click', tab.name]);
            },

            loadWords() {
                return new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        action: 'get'
                    }, ({ data }) => {
                        if (data) {
                            this.words = data;

                            resolve(data);
                        } else {
                            resolve([]);
                        }
                    });
                });
            },

            handleLevelFilterClick(level) {
                if (this.filter.level === level) {
                    this.filter.level = void 0;
                } else {
                    this.filter.level = level;
                }

                _gaq.push(['_trackEvent', 'options_words_filter', 'click', 'level']);
            },

            handleTagFilterClick(tag) {
                let index = this.filter.tags.findIndex(item => item == tag);

                if (index > -1) {
                    this.filter.tags.splice(index, 1);
                } else {
                    this.filter.tags.push(tag);
                }

                _gaq.push(['_trackEvent', 'options_words_filter', 'click', 'tags']);
            },

            handleConfigSubmit() {
                this.saveConfig();

                _gaq.push(['_trackEvent', 'options_general', 'save']);
            },

            saveConfig: function(silent) {
                let self = this;
                let newConfig = JSON.parse(JSON.stringify(this.config));

                browser.storage.sync.set({
                    config: newConfig
                }).then(resp => {
                    if (!silent) {
                        this.$message('保存成功');
                    }
                });
            },

            handleExportClick() {
                this.loadWords().then(words => this.exportWords(words));
            },

            exportWords(words) {
                if (!words.length) {
                    this.$message.warn('没有可导出的词语！');
                    
                    return;
                }

                words = JSON.parse(JSON.stringify(words));
                
                let csvContent = "data:text/csv;charset=utf-8,";

                words.forEach(({ name, trans, sentence, tags}, index) => {
                    let wordString = `${name};${trans.join(' ')};${sentence};${tags.join(';')}`;

                    csvContent += index < words.length ? wordString+ "\n" : wordString;
                });

                let encodedUri = encodeURI(csvContent);

                window.open(encodedUri);
                _gaq.push(['_trackEvent', 'options_advanced', 'click', 'export']);
            }
        }
    });
}

init();