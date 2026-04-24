import re

file_path = "src/pages/vocabulary/learning_plan_detail_page.tsx"

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make sure we have useLang imported
if "useLang" not in content:
    content = content.replace(
        "import { listNotebooks, type Notebook } from '../../api/notebook';",
        "import { useLang } from '../../i18n/LanguageContext';\nimport { listNotebooks, type Notebook } from '../../api/notebook';"
    )
if "const { id } = useParams" in content and "const { translations: t } = useLang();" not in content:
    content = content.replace(
        "const { id } = useParams<{ id: string }>();",
        "const { translations: t } = useLang();\n    const { id } = useParams<{ id: string }>();"
    )

replacements = [
    # Toasts
    ("showToast('加载计划失败', 'error')", "showToast(t.vocab.details.msgLoadFail, 'error')"),
    ("showToast('计划名称已保存', 'success')", "showToast(t.vocab.details.msgSaveSuccess, 'success')"),
    ("showToast('保存失败', 'error')", "showToast(t.vocab.details.msgSaveFail, 'error')"),
    ("showToast('每日词数需在 1-200 之间', 'error')", "showToast(t.vocab.details.msgDailyRange, 'error')"),
    ("showToast('每日词数已使用新配置保存', 'success')", "showToast(t.vocab.details.msgDailySaveSuccess, 'success')"),
    (
        "const msg = isQuotaDone\n                    ? '今日还没有学习记录，无法复习'\n                    : stats.remaining_today === 0\n                        ? `今日已学习 ${stats.studied_today} 词，完成每日目标！`\n                        : '今日没有需要复习的单词';",
        "const msg = isQuotaDone\n                    ? t.vocab.plans.msgNoReviewRecord\n                    : stats.remaining_today === 0\n                        ? t.vocab.plans.msgDailyGoalReached.replace('{n}', String(stats.studied_today))\n                        : t.vocab.plans.msgNoDueReview;"
    ),
    ("msg = 'AT币余额不足，请充值后重试'", "msg = t.vocab.details.msgInsufficientAT"),
    ("msg = '计划中没有单词，请先添加'", "msg = t.vocab.plans.msgEmptyWord"),
    ("msg = '计划不存在，请刷新后重试'", "msg = t.vocab.details.msgPlanNotFound"),
    ("msg = '计划配置冲突，请刷新后重试'", "msg = t.vocab.details.msgPlanConflict"),
    ("msg = `网络错误，已尝试 ${retryAttempt} 次 - ${errorMsg || '请检查网络后重试'}`", "msg = t.vocab.details.msgNetworkErr.replace('{n}', String(retryAttempt)).replace('{msg}', errorMsg || t.common.error)"),
    ("msg = '开始失败'", "msg = t.vocab.plans.msgStartFail"),
    ("showToast('单词不能为空', 'error')", "showToast(t.vocab.details.msgWordEmpty, 'error')"),
    ("showToast('该单词已在计划中', 'error')", "showToast(t.vocab.details.msgDuplicate, 'error')"),
    ("showToast('已添加', 'success')", "showToast(t.vocab.details.msgAddSuccess, 'success')"),
    ("showToast(status === 409 ? '该单词已在计划中' : '添加失败', 'error')", "showToast(status === 409 ? t.vocab.details.msgDuplicate : t.vocab.details.msgAddFail, 'error')"),
    ("const msg = skipped > 0\n                ? `已导入 ${entries_added} 个，跳过 ${skipped} 个重复单词`\n                : `已导入 ${entries_added} 个单词`;", "const msg = skipped > 0\n                ? t.vocab.details.msgImportSuccessSkip.replace('{n}', String(entries_added)).replace('{skipped}', String(skipped))\n                : t.vocab.details.msgImportSuccess.replace('{n}', String(entries_added));"),
    ("showToast('导入失败', 'error')", "showToast(t.vocab.details.msgImportFail, 'error')"),
    ("showToast('天数需为非负整数', 'error')", "showToast(t.vocab.details.msgDaysInvalid, 'error')"),
    ("showToast('复习日期已更新', 'success')", "showToast(t.vocab.details.msgUpdateSuccess, 'success')"),
    ("showToast('更新失败', 'error')", "showToast(t.vocab.details.msgUpdateFail, 'error')"),
    ("if (!confirm(`从计划中删除\"${entry.word}\"？`))", "if (!confirm(t.vocab.details.msgDeleteConfirm.replace('{word}', entry.word)))"),
    ("showToast('已删除', 'success')", "showToast(t.vocab.details.msgDeleteSuccess, 'success')"),
    ("showToast('删除失败', 'error')", "showToast(t.vocab.details.msgDeleteFail, 'error')"),
    
    # UI Elements
    (">← 返回<", ">{t.common.back}<"),
    (">每日<", ">{t.vocab.plans.labelDaily.split('{n}')[0].trim()}<"),
    ("\n                        词\n", "\n                        {t.vocab.plans.labelDaily.split('{n}')[1]?.trim() || ''}\n"),
    ("{starting ? '准备中…' : isQuotaDone ? '📖 开始复习' : '开始学习'}", "{starting ? t.vocab.plans.preparing : isQuotaDone ? t.vocab.plans.startReview : t.vocab.plans.startStudy}"),
    ("学习模式：", "{t.vocab.details.modeLabel}"),
    ("今日学习计划（已掌握 <strong>{plan.studied_today}</strong> / {plan.daily_count}）", "<span dangerouslySetInnerHTML={{ __html: t.vocab.details.todayTitle.replace('{studied}', String(plan.studied_today)).replace('{total}', String(plan.daily_count)) }} />"),
    
    # Tabs
    ("<h4>添加单词</h4>", "<h4>{t.vocab.details.addWords}</h4>"),
    ("{t === 'manual' ? '手动输入' : t === 'notebook' ? '从笔记本' : '从词书'}", "{t === 'manual' ? t.vocab.details.tabManual : t === 'notebook' ? t.vocab.details.tabNotebook : t.vocab.details.tabBook}"),
    
    # Manual Input
    ("placeholder=\"英文单词\"", "placeholder={t.vocab.details.manualWord}"),
    ("placeholder=\"中文释义\"", "placeholder={t.vocab.details.manualZh}"),
    ("placeholder=\"中文释义（可选）\"", "placeholder={t.vocab.details.manualZh}"),
    ("placeholder=\"音标（可选）e.g. /əˈbændən/\"", "placeholder={t.vocab.details.manualPhonetic}"),
    ("placeholder=\"词性（可选）e.g. v. / n. adj.\"", "placeholder={t.vocab.details.manualGrammar}"),
    ("<span className=\"lp-duplicate-hint\">已在计划中</span>", "<span className=\"lp-duplicate-hint\">{t.vocab.details.manualDuplicate}</span>"),
    ("添加\n                                </button>", "{t.vocab.details.manualAddBtn}\n                                </button>"),
    (">添加<", ">{t.vocab.details.manualAddBtn}<"),
    
    # Notebook Select
    ("<option value=\"\">— 选择笔记本 —</option>", "<option value=\"\">{t.vocab.details.nbSelect}</option>"),
    ("{nb.title}（{nb.word_count} 词）", "{nb.title} ({t.vocab.notebooks.cardWordCount.replace('{n}', String(nb.word_count))})"),
    ("{addBusy ? '导入中…' : '全部导入'}", "{addBusy ? t.vocab.details.nbImporting : t.vocab.details.nbImportAll}"),
    
    # Book View
    ("<option value=\"\">— 选择词书 —</option>", "<option value=\"\">{t.vocab.details.bookSelect}</option>"),
    ("{b.name}（{b.word_count} 词）", "{b.name} ({t.vocab.notebooks.cardWordCount.replace('{n}', String(b.word_count))})"),
    ("{m === 'all' ? '整本导入' : m === 'range' ? '范围导入' : '勾选导入'}", "{m === 'all' ? t.vocab.details.bookModeAll : m === 'range' ? t.vocab.details.bookModeRange : t.vocab.details.bookModeSelect}"),
    ("{addBusy ? '导入中…' : '整本导入'}", "{addBusy ? t.vocab.details.nbImporting : t.vocab.details.bookModeAll}"),
    ("序号\n                                            </span>", "{t.vocab.details.bookRangeIdx}\n                                            </span>"),
    ("{addBusy ? '导入中…' : '范围导入'}", "{addBusy ? t.vocab.details.nbImporting : t.vocab.details.bookModeRange}"),
    ("placeholder=\"搜索单词…\"", "placeholder={t.vocab.notebookDetail.searchPlaceholder}"),
    ("{addBusy ? '导入中…' : `导入已选（${selectedIds.size}）`}", "{addBusy ? t.vocab.details.nbImporting : t.vocab.details.bookImportSelected.replace('{n}', String(selectedIds.size))}"),
    ("上一页</button>", "{t.vocab.details.bookPrevPage}</button>"),
    ("下一页\n                                                </button>", "{t.vocab.details.bookNextPage}\n                                                </button>"),

    # Sort Controls
    ("<option value=\"default\">默认</option>", "<option value=\"default\">{t.vocab.details.sortDefault}</option>"),
    ("<option value=\"alphabetical\">英文字典序</option>", "<option value=\"alphabetical\">{t.vocab.details.sortAlpha}</option>"),
    ("<option value=\"proficiency\">熟练度</option>", "<option value=\"proficiency\">{t.vocab.details.sortProf}</option>"),
    ("title={sortAsc ? '倒序' : '正序'}", "title={sortAsc ? t.vocab.details.sortDesc : t.vocab.details.sortAsc}"),
    ("placeholder=\"搜索单词或释义…\"", "placeholder={t.vocab.details.listSearch}"),
    (">加载中…<", ">{t.common.loading}<"),
    ("{search ? '没有匹配的单词' : '还没有单词，请先添加'}", "{search ? t.vocab.details.listNoMatch : t.vocab.details.listEmpty}"),
    
    # Pager
    ("← 上一页\n                                    </button>", "{t.vocab.details.prevPage}\n                                    </button>"),
    ("第 {safePage} / {totalPages} 页\n                                        &nbsp;·&nbsp;共 {filtered.length} 词", "{t.vocab.details.pageInfo.replace('{page}', String(safePage)).replace('{total}', String(totalPages)).replace('{n}', String(filtered.length))}"),
    ("下一页 →\n                                    </button>", "{t.vocab.details.nextPage}\n                                    </button>"),
    
    # Word Row
    ("天后\n                        <span", "{t.vocab.intervals.daysUnit}\n                        <span"),
    ("title=\"从计划删除\"", "title={t.vocab.plans.btnDelete}"),
    ("{showExamples ? '收起例句' : `查看例句 (${entry.examples.length})`}", "{showExamples ? t.vocab.details.btnCollapseEx : t.vocab.details.btnExpandEx.replace('{n}', String(entry.examples.length))}"),
]

for old_str, new_str in replacements:
    content = content.replace(old_str, new_str)

# Calculate learned words - replacing <h4>词表（{entries.length}）</h4>
pattern = r"<h4>词表（\{entries\.length\}）</h4>"
learned_words_logic = """
                    <h4 dangerouslySetInnerHTML={{ __html: t.vocab.details.listTitle
                        .replace('{learned}', String(entries.filter(e => e.fsrs_state !== 0).length))
                        .replace('{total}', String(entries.length)) 
                    }} />
"""
content = re.sub(pattern, learned_words_logic, content)

# Map study modes dynamically
content = content.replace(
    "{label}",
    "{m === 'flashcard' ? t.vocab.modes.flashcard : m === 'choice' ? t.vocab.modes.choice : t.vocab.modes.write}"
)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
