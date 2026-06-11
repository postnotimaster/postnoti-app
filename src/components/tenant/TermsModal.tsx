import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TermsModalProps {
    visible: boolean;
    onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ visible, onClose }) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close" size={24} color="#64748b" />
                    </TouchableOpacity>

                    <View style={styles.header}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="document-text" size={32} color="#4A60AB" />
                        </View>
                        <Text style={styles.title}>우편물 수령규정</Text>
                    </View>

                    <View style={styles.termsBoxContainer}>
                        <ScrollView style={styles.termsScroll} contentContainerStyle={{ padding: 16 }}>
                            <Text style={styles.termsMainTitle}>우편물 알림 서비스 이용규정</Text>
                            <Text style={styles.termsDesc}>비상주 서비스의 우편물 수령은 사업자 운영에 필요한 최소한의 우편물에 한하여 제공됩니다. 과도한 우편물 수령 시 서비스가 제한되거나 중단될 수 있습니다.</Text>

                            <Text style={sectionTitleStyle}>1. 우편물 알림</Text>
                            <Text style={styles.termsText}>
                                • 우편물 도착 시 알림을 제공합니다.{'\n'}
                                • 도착 여부에 대한 개별 문의는 받지 않습니다.{'\n'}
                                • 2주 이상 미수령 시 알림이 중단될 수 있습니다.{'\n'}
                                • 월 5통 이상 수령 시 과다 수령으로 판단되어 알림이 중단될 수 있습니다.
                            </Text>

                            <Text style={sectionTitleStyle}>2. 보관기간</Text>
                            <Text style={styles.termsText}>
                                • 일반 우편물 보관기간: 14일{'\n'}
                                • 보관기간 경과 시 별도 통보 없이 폐기됩니다.
                            </Text>

                            <Text style={sectionTitleStyle}>3. 택배 수령</Text>
                            <Text style={styles.termsText}>
                                • 택배 수령은 원칙적으로 불가합니다.{'\n'}
                                • 부득이하게 수령된 경우 보관료가 발생할 수 있습니다. (1일 1,000원)
                            </Text>

                            <Text style={sectionTitleStyle}>4. 수령 제외 우편물</Text>
                            <Text style={styles.termsText}>
                                다음 우편물은 알림 없이 반송 또는 폐기될 수 있습니다.{'\n'}
                                • 광고·홍보 우편물{'\n'}
                                • 카드 명세서{'\n'}
                                • 각종 이용 명세서{'\n'}
                                • 정기 간행물{'\n'}
                                • 기타 사업 운영과 무관한 일반 안내 우편물
                            </Text>

                            <Text style={sectionTitleStyle}>5. 정기 고지·안내 우편물</Text>
                            <Text style={styles.termsText}>
                                다음 우편물은 최초 1회만 알림되며, 이후에는 알림 없이 폐기될 수 있습니다.{'\n'}
                                • 독촉장, 잡지, 교통 범칙금 및 과태료{'\n'}
                                • 국민연금/건강보험/근로복지공단 고지서{'\n'}
                                • 보험 만기 안내 등 각종 고지/단순 안내문{'\n'}
                                <Text style={styles.highlightText}>※ 교통 관련 고지서, 범칙금, 과태료는 월 2건 초과 시 알림이 중단될 수 있으며, 반복 수령 시 영구 중단될 수 있습니다.</Text>
                            </Text>

                            <Text style={sectionTitleStyle}>6. 폐기 대상 우편물</Text>
                            <Text style={styles.termsText}>
                                우편 담당자가 스팸성 또는 단순 안내성 우편물로 판단하는 경우 별도 알림 없이 즉시 폐기할 수 있습니다.{'\n'}
                                • 홍보물, 팸플릿, 카탈로그, 책자, 기타 광고물
                            </Text>

                            <Text style={sectionTitleStyle}>7. 등기 및 특별송달</Text>
                            <Text style={styles.termsText}>
                                법원 특별송달, 내용증명, 일반등기 등은 우체국 규정에 따라 센터에서 수령이 제한될 수 있습니다.{'\n'}
                                • 수원·분당센터: 수령 불가{'\n'}
                                • 용인센터: 일반등기 수령 가능{'\n'}
                                수령이 불가한 경우 우편도착안내서 도착 여부만 안내되며, 실제 수령은 집배원과 협의 후 진행해야 합니다.
                            </Text>

                            <Text style={sectionTitleStyle}>8. 대형 우편물</Text>
                            <Text style={styles.termsText}>
                                • 부피 또는 무게가 큰 우편물의 보관기간은 7일입니다.{'\n'}
                                • 보관기간 경과 시 폐기됩니다.{'\n'}
                                <Text style={styles.highlightText}>※ 세무사, 협회 등에서 발송하는 달력·캘린더는 알림 없이 폐기될 수 있으므로 실제 수령 주소지로 변경하시기 바랍니다.</Text>
                            </Text>

                            <Text style={sectionTitleStyle}>9. 면책사항</Text>
                            <Text style={styles.termsText}>
                                본 센터는 우편물의 분실, 훼손, 배송 지연, 미수령, 미알림 등으로 인해 발생하는 세금, 계약, 분쟁, 과태료, 법적 문제 및 기타 손해에 대하여 어떠한 책임도 부담하지 않습니다.{'\n\n'}
                                중요 우편물은 반드시 실제 수령 가능한 주소지로 변경하여 주시기 바랍니다.{'\n\n'}
                                본 우편물 알림 서비스는 회원 편의를 위한 부가서비스이며, 회원에게만 제공됩니다. 서비스 내용은 사전 통보 없이 변경·중단·종료될 수 있습니다.
                            </Text>

                        </ScrollView>
                    </View>

                    <View style={styles.infoContainer}>
                        <Text style={styles.infoText}>
                            본 우편물 수령규정 동의는 워크로 가입 및 우편알림변경(26.6)시 동의하셨습니다.
                        </Text>
                        <Text style={styles.infoText}>
                            철회를 원하시는 분은 010-9552-7295로 연락주시기 바랍니다.
                        </Text>
                        <Text style={[styles.infoText, { color: '#ef4444', marginTop: 4 }]}>
                            (동의철회를 하시면 우편물 알림은 중단되며 보관만 됩니다.)
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// React Native style object can be reused or nested
const sectionTitleStyle = {
    fontSize: 14,
    fontWeight: 'bold' as const,
    color: '#334155',
    marginTop: 16,
    marginBottom: 6,
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        position: 'relative',
        width: '100%',
        maxWidth: 400,
        backgroundColor: 'white',
        borderRadius: 20,
        maxHeight: '85%',
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
            },
            web: {
                boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.1)',
            }
        })
    },
    closeButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        padding: 5,
        zIndex: 10,
    },
    header: {
        alignItems: 'center',
        paddingTop: 30,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1e293b',
    },
    termsBoxContainer: {
        height: 240, // 상하 폭 축소 (기존 350)
        marginHorizontal: 20,
        marginVertical: 15,
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        overflow: 'hidden',
    },
    termsScroll: {
        flex: 1,
    },
    termsMainTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#1e293b',
        marginBottom: 8,
        textAlign: 'center',
    },
    termsDesc: {
        fontSize: 13,
        color: '#64748b',
        lineHeight: 20,
        marginBottom: 16,
        textAlign: 'center',
    },
    termsText: {
        fontSize: 13,
        color: '#475569',
        lineHeight: 20,
        paddingLeft: 4,
    },
    highlightText: {
        color: '#dc2626',
        fontWeight: '600',
    },
    termsWarning: {
        marginTop: 24,
        padding: 12,
        backgroundColor: '#fef2f2',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#fecaca',
        fontSize: 13,
        fontWeight: 'bold',
        color: '#991b1b',
        lineHeight: 20,
        textAlign: 'center',
    },
    infoContainer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        backgroundColor: '#fafafa',
        alignItems: 'center',
    },
    infoText: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 18,
        textAlign: 'center',
        fontWeight: '500',
    },
});
