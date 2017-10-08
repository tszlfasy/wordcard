
import $ from 'jquery'
import _ from 'underscore'
import Translate from '../../js/translate'
import Vue from 'vue'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-default/index.css'
import './translate.scss'
import ga from '../../js/common/ga'
import InputTag from 'vue-input-tag'

Vue.use(ElementUI)

function render(word, surroundings, parentWin) {
    new Vue({
        el: '#main',
        data: function() {
            return {
                word,
                wordEditable: false,
                surroundings,
                sentenceEditable: false,
                newWordDef: '',
                translate: {},
                wordTags: [],
                orgWord: null
            }
        },

        mounted() {
            this.loadWord();
        },

        components: {
            InputTag
        },

        methods: {
            loadWord() {
                chrome.runtime.sendMessage({
                    action: 'find',
                    word: this.word
                }, ({ data }) => {
                    if (data) {
                        this.orgWord = data;
                    }
                });

                this.getTranslate();
            },
            getTranslate() {
                Translate.translate(this.word).then(data => {
                    if (!data.basic) {
                        return false;
                    }
        
                    this.translate = {
                        phonetic: data.basic['us-phonetic'],
                        trans: data.translation,
                        explains: data.basic.explains
                    };
        
                    setTimeout(function() {
                        Translate.playAudio(word);
                    }, 1000);
                });
            },

            playAudio() {
                Translate.playAudio(this.word);
            },

            enbaleWordInput() {
                this.wordEditable = true;
                _gaq.push(['_trackEvent', 'iframe', 'click', 'editword']);
            },

            handleDefAdd() {
                if (this.newWordDef) {
                    this.translate.trans.push(this.newWordDef);
                    this.newWordDef = '';
                    _gaq.push(['_trackEvent', 'iframe', 'input', 'addDef']);
                }
            },

            handleTagsChange() {
                _gaq.push(['_trackEvent', 'iframe', 'input', 'addTags']);
            },

            toggleEdit() {
                this.sentenceEditable = !this.sentenceEditable;
                _gaq.push(['_trackEvent', 'iframe', 'click', 'editsentence']);
            },

            saveSentence() {
                var sentence = this.surroundings;

                this.sentenceEditable = false;
            },
    
            updateWord() {
                if (this.wordEditable) {
                    this.wordEditable = false;
                    this.loadWord();
                    _gaq.push(['_trackEvent', 'iframe', 'input', 'updateword']);
                }
            },

            handleCloseClick() {
                parentWin.postMessage({
                    type: 'popup'
                }, '*');
            },

            handleDeleteClick() {
                var self = this;
    
                chrome.extension.sendRequest({
                        'action': 'remove',
                        'data': {
                            id: self.wordId
                        }
                    },
                    function(resp) {
                        self.close();
                    });
            },

            save() {
                let self = this;
                let attrs = {
                    name: this.word,
                    sentence: this.surroundings,
                    trans: this.translate.trans,
                    tags: this.wordTags
                };
                
                chrome.runtime.sendMessage({
                    'action': 'create',
                    'data': attrs
                }, function({ data }) {
                    self.orgWord = data;
                    self.$message('Save successfully');     
                });

                _gaq.push(['_trackEvent', 'iframe', 'save']);
            },

            handleSaveClick() {
                if (this.orgWord) {
                    this.$confirm('会覆盖单词库里的单词，确定要继续吗?', '提示', {
                        confirmButtonText: '确定',
                        cancelButtonText: '取消',
                        type: 'warning'
                    }).then(() => {
                        this.save();
                    }).catch(() => { });
                } else {
                    this.save();
                }
            }
        }
    });
}

window.addEventListener('message', function(event) {
    render(event.data.word, event.data.surroundings, event.source);
    ga();
});